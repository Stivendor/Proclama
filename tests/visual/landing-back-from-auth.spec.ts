import { test, expect } from '@playwright/test'

/**
 * Regresión: entrar al login y pulsar "Volver" dejaba la landing en blanco.
 *
 * LandingView no se desmonta al mostrar el login, solo cambia el árbol que
 * devuelve. El efecto del IntersectionObserver tenía deps [], así que no volvía
 * a correr: los .rise nuevos nacían en opacity:0 sin nadie que los revelara y
 * el visitante solo veía la barra y el pie.
 */

function readRiseState() {
  const els = [...document.querySelectorAll('.rise')]
  return {
    total: els.length,
    invisibles: els.filter((e) => getComputedStyle(e).opacity === '0').length,
  }
}

test('la landing sigue visible al volver desde el login', async ({ page }) => {
  await page.goto('/')
  // networkidle: sin las imagenes cargadas la pagina mide menos y el recorrido
  // se queda corto, dejando secciones sin pasar por el observer.
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('.lp .rise')

  const scrollThrough = () =>
    page.evaluate(async () => {
      const lp = document.querySelector('.lp') as HTMLElement
      for (let y = 0; y <= lp.scrollHeight; y += 400) {
        lp.scrollTop = y
        await new Promise((r) => setTimeout(r, 60))
      }
    })

  await scrollThrough()
  await expect.poll(() => page.evaluate(readRiseState)).toMatchObject({ invisibles: 0 })

  await page.getByRole('button', { name: /^Acceder$/ }).click()
  await page.waitForSelector('.landing-auth')

  await page.getByRole('button', { name: /Volver/ }).click()
  await page.waitForSelector('.lp .rise')

  // Lo que queda en pantalla al volver tiene que revelarse solo.
  await expect(page.getByRole('heading', { name: /Proyecta tu servicio/ })).toBeVisible()

  // Y el efecto tiene que haberse vuelto a montar sobre el árbol nuevo. Sin esto
  // la página se ve, pero porque no hay observer ni animación: el fallo original
  // seguiría latente esperando a que algo vuelva a esconder las secciones.
  await expect(page.locator('.lp.lp-animate')).toHaveCount(1)

  // Y el resto al seguir bajando, en vez de quedarse en blanco para siempre.
  await scrollThrough()
  await expect.poll(() => page.evaluate(readRiseState)).toMatchObject({ invisibles: 0 })
})

test('sin el efecto de entrada la landing no se esconde sola', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('.lp')

  // lp-animate es lo único que aplica opacity:0. Lo pone el mismo efecto que
  // luego revela, así que si el JS no llega a correr no hay nada escondido.
  const hidesOnlyWithJs = await page.evaluate(() => {
    const lp = document.querySelector('.lp') as HTMLElement
    lp.classList.remove('lp-animate')
    const els = [...document.querySelectorAll('.rise')]
    return els.every((e) => getComputedStyle(e).opacity !== '0')
  })

  expect(hidesOnlyWithJs).toBe(true)
})
