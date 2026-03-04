import Dexie, { Table } from 'dexie'
import type { Song, Setlist, AppSettings } from '@/types'

export class ProclamaDB extends Dexie {
  songs!: Table<Song>
  setlists!: Table<Setlist>
  settings!: Table<AppSettings & { id: number }>

  constructor() {
    super('ProclamaDB')
    this.version(1).stores({
      songs:    '++id, title, artist, language, usageCount, createdAt',
      setlists: '++id, name, date, createdAt',
      settings: '++id'
    })
  }
}

export const db = new ProclamaDB()

// ─── Seed con canciones de ejemplo ───────────────────────────────────────────
export async function seedDatabase() {
  const count = await db.songs.count()
  if (count > 0) return

  const now = new Date()
  const sampleSongs: Omit<Song, 'id'>[] = [
    {
      title: 'Cuán Grande Es Él',
      artist: 'Himno Clásico',
      lyrics: `[Verso 1]
Señor mi Dios, al contemplar los cielos
El firmamento y las estrellas mil
Al oír tu voz en los poderosos truenos
Y ver brillar al sol en su cenit

[Coro]
Entonces canto mi alma a mi Salvador
Cuán grande es él, cuán grande es él
Entonces canto mi alma a mi Salvador
Cuán grande es él, cuán grande es él

[Verso 2]
Al contemplar los montes y los valles
Y escuchar el murmullo del riachuelo
Cuando pienso que Jesús no me abandona
Sino que murió en la cruz por mí

[Coro]
Entonces canto mi alma a mi Salvador
Cuán grande es él, cuán grande es él
Entonces canto mi alma a mi Salvador
Cuán grande es él, cuán grande es él`,
      key: 'Sol',
      tags: ['Adoración', 'Clásico'],
      language: 'Español',
      usageCount: 0,
      createdAt: now,
      updatedAt: now
    },
    {
      title: 'Santo Espíritu',
      artist: 'Hillsong',
      lyrics: `[Verso 1]
Hay un lugar de quietud
Donde puedo escuchar tu voz
En la calma de tu amor
Me renuevo en tu presencia

[Pre-Coro]
Llena este lugar con tu gloria
Desciende sobre nosotros hoy

[Coro]
Santo Espíritu tú eres bienvenido aquí
Ven inunda este lugar con tu gloria
Te necesitamos aquí

[Puente]
Que tu reino venga
Que tu voluntad se haga
Aquí en la tierra como en el cielo`,
      key: 'Re',
      tags: ['Adoración', 'Espíritu Santo', 'Moderno'],
      language: 'Español',
      usageCount: 0,
      createdAt: now,
      updatedAt: now
    },
    {
      title: 'Océanos',
      artist: 'Hillsong United',
      lyrics: `[Verso 1]
Me llamas a ir más allá de las orillas seguras
A caminar sobre las aguas
Hacia ti en medio del miedo

[Coro]
Espíritu llévame donde mi fe no tenga fronteras
Donde yo camine sobre las aguas
En el océano caminaré

[Verso 2]
Tu gracia es suficiente para mí
Tu poder se perfecciona en mi debilidad
Cuando me sostienes en el fondo del mar
Llevo mi oración contigo

[Puente]
Y yo te buscaré con todo mi corazón
Aférrate a mí mientras camino a través de las aguas profundas`,
      key: 'La',
      tags: ['Fe', 'Moderno', 'Hillsong'],
      language: 'Español',
      usageCount: 0,
      createdAt: now,
      updatedAt: now
    },
    {
      title: 'Grandes Cosas',
      artist: 'Phil Wickham',
      lyrics: `[Verso 1]
Alaba al Señor Dios Todopoderoso
El único que es digno de Gloria
Maravillas sin número han hecho sus manos
Que toda la tierra lo alabe

[Coro]
Grandes cosas ha hecho Él
¡Canta con alegría!
Grandes cosas ha hecho Él
Y grandes cosas hará

[Verso 2]
Empuja en las oscuras aguas de lo desconocido
El Dios que estaba antes del tiempo aún reina
No temas porque Él ha prometido
Que nunca te dejará ni te abandonará

[Puente]
¡Aleluya! ¡Dios es fiel!
¡Aleluya! ¡Dios es bueno!`,
      key: 'Mi',
      tags: ['Alabanza', 'Moderno'],
      language: 'Español',
      usageCount: 0,
      createdAt: now,
      updatedAt: now
    },
    {
      title: 'Rindo Todo a Ti',
      artist: 'Judson Wheeler Van DeVenter',
      lyrics: `[Verso 1]
Todo a Jesucristo yo me rindo ya
Todo a sus pies dejo yo
Todo de mi vida yo le entrego hoy
Dejo todo a mi Señor

[Coro]
Me rindo a ti, me rindo a ti
Con todo mi ser a ti me rindo ya
Me rindo a ti, me rindo a ti
Con todo mi ser a ti

[Verso 2]
Todo a Jesucristo yo le consagré
Mi voluntad y mi ser
Lleno de su Espíritu vivir podré
Gloria a Cristo mi Rey`,
      key: 'Fa',
      tags: ['Consagración', 'Clásico'],
      language: 'Español',
      usageCount: 0,
      createdAt: now,
      updatedAt: now
    }
  ]

  await db.songs.bulkAdd(sampleSongs)
  console.log('✅ Base de datos inicializada con canciones de ejemplo')
}
