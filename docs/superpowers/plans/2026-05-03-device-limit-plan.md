# Device Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce a two-device limit for premium users and require a user-provided device name on first registration.

**Architecture:** Supabase owns the limit through a transaction-safe RPC. The frontend asks for a device name only when the current device is not registered, then trusts the RPC response to allow or block access.

**Tech Stack:** Supabase SQL/RLS/RPC, React 18, TypeScript, Zustand, Vitest.

---

## File Map

- Create: `supabase/migrations/20260503000000_device_limit.sql` - table hardening, RLS policies, RPCs for registration and rename.
- Modify: `src/services/supabase.ts` - replace direct device upsert with RPC-backed API and add rename function.
- Create: `src/components/DeviceNameModal.tsx` - first-registration modal for naming the current device.
- Modify: `src/App.tsx` - wire premium device registration flow and blocked state.
- Modify: `src/components/DeviceList.tsx` - support device rename and display 2-device usage.
- Modify: `src/components/DeviceBlockedModal.tsx` - preserve/retry current device name after revocation.
- Modify: `src/test/deviceControl.test.ts` - update tests for RPC behavior.
- Create: `src/test/deviceNameModal.test.tsx` - validate naming modal behavior.

---

### Task 1: Supabase Migration and RPC

**Files:**
- Create: `supabase/migrations/20260503000000_device_limit.sql`

- [ ] **Step 1: Create migration with table, RLS, and RPCs**

```sql
create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_name text not null,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id)
);

alter table public.user_devices enable row level security;

drop policy if exists "Users can view own devices" on public.user_devices;
create policy "Users can view own devices"
  on public.user_devices for select
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own devices" on public.user_devices;
create policy "Users can delete own devices"
  on public.user_devices for delete
  using (auth.uid() = user_id);

create or replace function public.get_user_devices()
returns table (
  id uuid,
  device_id text,
  device_name text,
  last_seen timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select d.id, d.device_id, d.device_name, d.last_seen, d.created_at
  from public.user_devices d
  where d.user_id = auth.uid()
  order by d.last_seen desc;
$$;

create or replace function public.register_user_device(
  p_device_id text,
  p_device_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan text;
  v_role text;
  v_name text := left(trim(p_device_name), 40);
  v_device_count integer;
  v_devices jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(p_device_id), '') is null then
    raise exception 'device_id is required';
  end if;

  if nullif(v_name, '') is null then
    raise exception 'device_name is required';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  select role, plan into v_role, v_plan
  from public.profiles
  where id = v_user_id;

  if exists (
    select 1 from public.user_devices
    where user_id = v_user_id and device_id = p_device_id
  ) then
    update public.user_devices
    set device_name = v_name,
        last_seen = now(),
        updated_at = now()
    where user_id = v_user_id and device_id = p_device_id;
  else
    select count(*) into v_device_count
    from public.user_devices
    where user_id = v_user_id;

    if coalesce(v_plan, 'free') = 'premium' and coalesce(v_role, 'user') <> 'admin' and v_device_count >= 2 then
      select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) into v_devices
      from (
        select id, device_id, device_name, last_seen, created_at
        from public.user_devices
        where user_id = v_user_id
        order by last_seen desc
      ) d;

      return jsonb_build_object(
        'allowed', false,
        'reason', 'device_limit_reached',
        'devices', v_devices
      );
    end if;

    insert into public.user_devices (user_id, device_id, device_name, last_seen)
    values (v_user_id, p_device_id, v_name, now());
  end if;

  select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) into v_devices
  from (
    select id, device_id, device_name, last_seen, created_at
    from public.user_devices
    where user_id = v_user_id
    order by last_seen desc
  ) d;

  return jsonb_build_object(
    'allowed', true,
    'reason', null,
    'devices', v_devices
  );
end;
$$;

create or replace function public.rename_user_device(
  p_device_row_id uuid,
  p_device_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := left(trim(p_device_name), 40);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(v_name, '') is null then
    raise exception 'device_name is required';
  end if;

  update public.user_devices
  set device_name = v_name,
      updated_at = now()
  where id = p_device_row_id and user_id = v_user_id;

  return jsonb_build_object('success', found);
end;
$$;
```

- [ ] **Step 2: Apply migration locally or in Supabase**

Run: `supabase db push`

Expected: Migration applies without SQL errors.

---

### Task 2: Device Service API

**Files:**
- Modify: `src/services/supabase.ts`
- Test: `src/test/deviceControl.test.ts`

- [ ] **Step 1: Update types and tests first**

Add expected result shape in `src/test/deviceControl.test.ts`:

```ts
it('calls register_user_device RPC and maps blocked result', async () => {
  const rpcMock = vi.fn().mockResolvedValue({
    data: {
      allowed: false,
      reason: 'device_limit_reached',
      devices: [
        {
          id: 'row-1',
          device_id: 'device-a',
          device_name: 'PC iglesia',
          last_seen: '2026-05-03T00:00:00.000Z',
          created_at: '2026-05-01T00:00:00.000Z',
        },
      ],
    },
    error: null,
  })

  vi.spyOn(supabase, 'rpc').mockImplementation(rpcMock as any)

  const result = await registerDevice('device-new', 'Celular recepcion')

  expect(rpcMock).toHaveBeenCalledWith('register_user_device', {
    p_device_id: 'device-new',
    p_device_name: 'Celular recepcion',
  })
  expect(result.allowed).toBe(false)
  expect(result.reason).toBe('device_limit_reached')
  expect(result.devices[0].deviceName).toBe('PC iglesia')
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- src/test/deviceControl.test.ts`

Expected: FAIL because `registerDevice` still returns `UserDevice[]`.

- [ ] **Step 3: Implement service types and mapping**

In `src/services/supabase.ts`, replace `registerDevice` return with:

```ts
export type DeviceRegistrationResult = {
  allowed: boolean
  reason: 'device_limit_reached' | null
  devices: UserDevice[]
}

function mapDeviceRow(row: any, currentDeviceId?: string): UserDevice {
  return {
    id: row.id,
    deviceId: row.device_id,
    deviceName: row.device_name,
    lastSeen: row.last_seen,
    createdAt: row.created_at,
    isCurrent: currentDeviceId ? row.device_id === currentDeviceId : false,
  }
}

export async function registerDevice(
  deviceId: string,
  deviceName: string
): Promise<DeviceRegistrationResult> {
  const { data, error } = await supabase.rpc('register_user_device', {
    p_device_id: deviceId,
    p_device_name: deviceName,
  })

  if (error || !data) {
    console.error('[Devices] Error registering device:', error?.message)
    return { allowed: false, reason: 'device_limit_reached', devices: [] }
  }

  return {
    allowed: Boolean(data.allowed),
    reason: data.reason ?? null,
    devices: (data.devices ?? []).map((row: any) => mapDeviceRow(row, deviceId)),
  }
}
```

Also update `fetchUserDevices` to use `mapDeviceRow`, and add:

```ts
export async function renameDevice(deviceRowId: string, deviceName: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('rename_user_device', {
    p_device_row_id: deviceRowId,
    p_device_name: deviceName,
  })

  if (error) {
    console.error('[Devices] Error renaming device:', error.message)
    return false
  }

  return Boolean(data?.success)
}
```

- [ ] **Step 4: Run device tests**

Run: `npm test -- src/test/deviceControl.test.ts`

Expected: PASS.

---

### Task 3: First-Registration Naming Modal

**Files:**
- Create: `src/components/DeviceNameModal.tsx`
- Create: `src/test/deviceNameModal.test.tsx`

- [ ] **Step 1: Write modal tests**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DeviceNameModal from '@/components/DeviceNameModal'

describe('DeviceNameModal', () => {
  it('requires a non-empty device name', () => {
    const onSubmit = vi.fn()
    render(<DeviceNameModal suggestedName="PC Windows" loading={false} onSubmit={onSubmit} onLogout={() => {}} />)

    const input = screen.getByLabelText(/nombre del dispositivo/i)
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/escribe un nombre/i)).toBeInTheDocument()
  })

  it('submits trimmed device name', () => {
    const onSubmit = vi.fn()
    render(<DeviceNameModal suggestedName="PC Windows" loading={false} onSubmit={onSubmit} onLogout={() => {}} />)

    const input = screen.getByLabelText(/nombre del dispositivo/i)
    fireEvent.change(input, { target: { value: '  PC iglesia  ' } })
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    expect(onSubmit).toHaveBeenCalledWith('PC iglesia')
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- src/test/deviceNameModal.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Create component**

Implement `DeviceNameModal` with props:

```ts
type DeviceNameModalProps = {
  suggestedName: string
  loading: boolean
  error?: string
  onSubmit: (name: string) => void
  onLogout: () => void
}
```

Behavior:

- Default input value is `suggestedName`.
- Trim on submit.
- Reject empty value with inline error.
- Limit to 40 characters with `maxLength={40}`.
- Use existing button/modal styling patterns from `MFAModal` and `DeviceBlockedModal`.

- [ ] **Step 4: Run modal test**

Run: `npm test -- src/test/deviceNameModal.test.tsx`

Expected: PASS.

---

### Task 4: App Device Gate

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/stores/index.ts`

- [ ] **Step 1: Add store state for pending device naming**

In `AppStore`, add:

```ts
deviceNameRequired: boolean
setDeviceNameRequired: (v: boolean) => void
pendingDeviceName: string
setPendingDeviceName: (v: string) => void
```

Initialize:

```ts
deviceNameRequired: false,
setDeviceNameRequired: (v) => set({ deviceNameRequired: v }),
pendingDeviceName: '',
setPendingDeviceName: (v) => set({ pendingDeviceName: v }),
```

Do not persist these fields.

- [ ] **Step 2: Replace `checkDeviceLimit` flow**

In `App.tsx`, make `checkDeviceLimit`:

```ts
const checkDeviceLimit = async (plan: string, role?: string | null) => {
  if (plan !== 'premium' && role !== 'admin') return;
  const { getDeviceId, getDeviceName } = await import('@/utils/deviceFingerprint');
  const { fetchUserDevices, registerDevice } = await import('@/services/supabase');
  const deviceId = getDeviceId();
  const devices = await fetchUserDevices(deviceId);
  const current = devices.find(d => d.isCurrent);

  if (!current) {
    useAppStore.getState().setPendingDeviceName(getDeviceName());
    useAppStore.getState().setUserDevices(devices);
    useAppStore.getState().setDeviceNameRequired(true);
    return;
  }

  const result = await registerDevice(deviceId, current.deviceName);
  useAppStore.getState().setUserDevices(result.devices);
  useAppStore.getState().setDeviceBlocked(!result.allowed);
}
```

- [ ] **Step 3: Render naming modal before main app**

In `AppContent`, read `deviceNameRequired` and `pendingDeviceName`, render `DeviceNameModal`, and submit:

```ts
const handleDeviceNameSubmit = async (name: string) => {
  const { getDeviceId } = await import('@/utils/deviceFingerprint')
  const { registerDevice } = await import('@/services/supabase')
  const result = await registerDevice(getDeviceId(), name)
  useAppStore.getState().setUserDevices(result.devices)
  useAppStore.getState().setDeviceNameRequired(false)
  useAppStore.getState().setDeviceBlocked(!result.allowed)
}
```

- [ ] **Step 4: Run app-related tests**

Run: `npm test -- src/test/deviceControl.test.ts src/test/deviceNameModal.test.tsx`

Expected: PASS.

---

### Task 5: Device List Rename UX

**Files:**
- Modify: `src/components/DeviceList.tsx`
- Modify: `src/services/supabase.ts`

- [ ] **Step 1: Add rename UI**

In `DeviceList`, add local state:

```ts
const [editingId, setEditingId] = useState<string | null>(null)
const [editingName, setEditingName] = useState('')
```

For each row, show an edit button. When editing, replace the label with an input and Save/Cancel buttons.

- [ ] **Step 2: Save rename through RPC**

Use `renameDevice(device.id, editingName.trim())`. On success, call `load()`.

- [ ] **Step 3: Display usage**

Above the list, show:

```tsx
<div style={{ color: '#778398', fontSize: 12 }}>
  {devices.length} de 2 dispositivos usados
</div>
```

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: TypeScript and Vite build complete successfully.

---

### Task 6: Blocked Modal Retry

**Files:**
- Modify: `src/components/DeviceBlockedModal.tsx`

- [ ] **Step 1: Keep selected current-device name**

Read `pendingDeviceName` from the store. After a successful revocation, call `registerDevice(getDeviceId(), pendingDeviceName || getDeviceName())`.

- [ ] **Step 2: Respect RPC result**

If retry returns `allowed: true`, set `deviceBlocked(false)` and update devices. If it is still blocked, keep modal open with updated devices.

- [ ] **Step 3: Run device tests**

Run: `npm test -- src/test/deviceControl.test.ts src/test/deviceNameModal.test.tsx`

Expected: PASS.

---

### Task 7: Final Verification

**Files:**
- All modified files

- [ ] **Step 1: Run security/dependency check**

Run: `npm audit --omit=dev`

Expected: `found 0 vulnerabilities`.

- [ ] **Step 2: Run targeted tests**

Run: `npm test -- src/test/deviceControl.test.ts src/test/deviceNameModal.test.tsx`

Expected: all tests pass.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: build exits 0. Existing chunk-size warnings are acceptable.

- [ ] **Step 4: Review diff**

Run: `git diff --stat`

Expected: diff includes migration, device service, naming modal, app gate, device list, tests, and docs only.
