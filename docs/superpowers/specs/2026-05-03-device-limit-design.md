# Device Limit Design

## Goal

Limit premium accounts to two active devices while letting users assign clear device names, such as "PC iglesia" or "Celular recepcion", during the first registration of each device.

## Scope

This feature applies only to authenticated premium users. Guest and free users are not blocked by device count. The frontend may guide the user, but Supabase must make the final allow/block decision.

## Product Behavior

When a premium user signs in from a browser/device that has not been registered before, Proclama asks for a required device name before granting premium access. The app suggests the current automatic name from the browser, for example "PC Windows" or "iPhone/iPad", but the user can replace it with a human-friendly label.

If the account has fewer than two registered devices, Supabase registers the new device and the app continues normally. If the account already has two different registered devices, Supabase rejects the registration and the app shows the existing blocked-device flow. The user can revoke one existing device and then register the current device with the chosen name.

Existing registered devices continue to work without asking again. Their `last_seen` timestamp updates on sign-in. Users can rename devices from Settings.

## Supabase Design

The source of truth is the `user_devices` table. It needs:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `device_id text not null`
- `device_name text not null`
- `last_seen timestamptz not null default now()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `unique (user_id, device_id)`

RLS must be enabled. Users can select and delete only their own device rows. Direct insert/update from the client should be avoided for registration because the limit must be enforced atomically by an RPC.

The registration RPC is `register_user_device(p_device_id text, p_device_name text)`. It uses `auth.uid()`, validates the name, checks the user's plan in `profiles`, updates an existing device if found, and inserts a new device only when the premium account has fewer than two devices.

To avoid two simultaneous first-time registrations bypassing the limit, the RPC must run as `security definer` and take a transaction-level advisory lock derived from the user id before counting and inserting devices.

Recommended response shape:

```json
{
  "allowed": true,
  "reason": null,
  "devices": []
}
```

When blocked:

```json
{
  "allowed": false,
  "reason": "device_limit_reached",
  "devices": []
}
```

## Frontend Design

`App.tsx` keeps the current premium-only device check, but replaces direct `registerDevice()` with a server-authoritative registration flow:

1. Load the Supabase profile.
2. If the user is premium/admin, get local `deviceId`.
3. Check whether the device already exists with `fetchUserDevices(deviceId)`.
4. If it exists, call `registerDevice(deviceId, existingName)` to refresh `last_seen`.
5. If it does not exist, show a required modal to name the device.
6. Submit the name to `registerDevice(deviceId, name)`.
7. If allowed, continue.
8. If blocked, set `deviceBlocked = true` and show the revocation modal.

The naming modal should be simple and focused: title, one text input, suggested default name, submit button, and sign-out/cancel path. Device names are trimmed and limited to 40 characters.

`DeviceList` adds rename support. The current device can also be renamed because users may initially accept a generic suggestion and refine it from Settings.

## Error Handling

If device registration fails due to network or RPC errors, the app should not silently grant premium access. It should show a clear retry state. This avoids turning outages into license bypass.

If revocation succeeds, the app retries registration for the current device using the previously entered name. If the user has not entered a name yet, the naming modal appears again.

## Security Notes

The device id is a client-generated UUID stored in localStorage, so it is not a secure hardware fingerprint. This is intentional: the goal is licensing friction, not anti-fraud certainty. Real enforcement comes from Supabase counting registered devices per authenticated user.

Deleting localStorage makes the browser appear as a new device. That is acceptable because the account still cannot exceed two active registered devices without revoking one.

## Testing Requirements

Tests must cover:

- Existing device updates `last_seen` and remains allowed.
- New premium device is allowed when the account has zero or one device.
- New premium device is blocked when the account already has two different devices.
- Free users are not blocked by device count.
- Device names are required, trimmed, and length-limited.
- Revoking a device allows a blocked user to retry registration.
- Frontend sets `deviceBlocked` only from the RPC result, not from client-side guessing.
