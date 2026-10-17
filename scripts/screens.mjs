import { execFileSync, spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9333
const BASE = process.env.BASE ?? 'http://localhost:5102'
const OUT = process.argv[2] ?? 'C:\\tmp\\marketplace-shots'
const ACCESS = process.env.ACCESS ?? ''
const REFRESH = process.env.REFRESH ?? ''
const EDIT_ID = process.env.EDIT_ID ?? ''
const ADMIN_ACCESS = process.env.ADMIN_ACCESS ?? ''
const ADMIN_REFRESH = process.env.ADMIN_REFRESH ?? ''

mkdirSync(OUT, { recursive: true })

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--window-size=1280,900',
    `--user-data-dir=${OUT}\\profile`,
    'about:blank',
  ],
  { stdio: 'ignore' },
)

async function cdpUrl() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const targets = await res.json()
      const page = targets.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
    }
    await sleep(200)
  }
  throw new Error('Chrome never opened its debugging port')
}

const ws = new WebSocket(await cdpUrl())
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))

let nextId = 0
const pending = new Map()
const events = []

ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id !== undefined) {
    const entry = pending.get(message.id)
    pending.delete(message.id)
    message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.resolve(message.result)
  } else {
    events.push(message)
  }
})

function send(method, params = {}) {
  const id = ++nextId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const { result } = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  return result.value
}

async function waitFor(expression, label, ms = 10_000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (await evaluate(`Boolean(${expression})`)) return true
    await sleep(150)
  }
  console.log(`  ! timeout esperando: ${label}`)
  return false
}

async function goto(path) {
  events.length = 0
  await send('Page.navigate', { url: `${BASE}${path}` })
  await sleep(400)
}

async function shot(name, full = false) {
  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: full,
  })
  writeFileSync(`${OUT}\\${name}.png`, Buffer.from(data, 'base64'))
}

function consoleProblems() {
  const out = []
  for (const event of events) {
    if (event.method === 'Runtime.exceptionThrown') {
      out.push(`EXCEPTION ${event.params.exceptionDetails.text} ${event.params.exceptionDetails.exception?.description ?? ''}`)
    }
    if (event.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(event.params.type)) {
      out.push(`${event.params.type.toUpperCase()} ${event.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`)
    }
  }
  return out
}

async function step(name, path, expectation, label, full = false) {
  await goto(path)
  const ok = expectation ? await waitFor(expectation, label) : true
  await shot(name, full)
  const problems = consoleProblems().filter((p) => !p.includes('Download the React DevTools'))
  console.log(`${ok ? 'OK ' : 'XX '} ${path.padEnd(42)} ${label}`)
  for (const problem of problems.slice(0, 4)) console.log(`     ${problem.slice(0, 180)}`)
  return ok && problems.length === 0
}

execFileSync(
  'docker',
  ['exec', 'marketplace_postgres', 'psql', '-U', 'postgres', '-d', 'marketplace', '-qtAc',
   "UPDATE sellers SET status='pending', status_reason=NULL WHERE slug='alebrijes-de-oaxaca'"],
  { encoding: 'utf8' },
)

await send('Page.enable')
await send('Runtime.enable')

await send('Page.navigate', { url: BASE })
await sleep(600)
await evaluate('localStorage.clear(); true')

const results = []

results.push(await step('01-catalogo', '/', `document.body.innerText.includes('Jarrón de barro')`, 'catálogo con datos reales'))
results.push(await step('02-busqueda', '/?q=jarron', `document.body.innerText.includes('Jarrón de barro') && !document.body.innerText.includes('Piñata')`, 'búsqueda filtra de verdad'))
results.push(await step('02b-borrador-oculto', '/?q=talavera', `!document.body.innerText.includes('Plato de talavera') && (document.body.innerText.includes('Todavía no hay nada') || document.querySelectorAll('a[href^="/p/"]').length > 0)`, 'un borrador no aparece en el catálogo público'))
results.push(await step('02c-categorias', '/', `document.body.innerText.includes('Papel y cartonería') && document.body.innerText.includes('Talavera')`, 'chips de categoría'))
results.push(await step('02d-filtro-categoria', '/?category=papel-y-cartoneria', `document.body.innerText.includes('Piñata de siete picos') && !document.body.innerText.includes('Jarrón')`, 'filtro por categoría deja una sola'))
results.push(await step('03-busqueda-vacia', '/?q=refrigerador', `document.body.innerText.includes('Todavía no hay nada')`, 'estado vacío honesto'))
results.push(await step('04-producto', '/p/jarron-barro-brunido', `document.querySelector('.text-4xl')?.textContent.trim() === '$480.00' && [...document.querySelectorAll('button')].some(b => b.disabled && b.textContent.includes('45 cm')) && document.body.innerText.includes('bruñido')`, 'ficha: preselecciona la barata con stock, agotada deshabilitada'))
results.push(await step('04b-opiniones', '/p/pinata-siete-picos-demo', `document.body.innerText.includes('Opiniones')`, 'bloque de opiniones en la ficha', true))
results.push(await step('05-tienda', '/t/barro-y-talavera', `document.body.innerText.includes('Barro y Talavera')`, 'página de tienda'))
results.push(await step('06-entrar', '/entrar', `document.querySelector('input[type=password]')`, 'formulario de login'))
results.push(await step('07-crear-cuenta', '/crear-cuenta', `document.body.innerText.includes('Mínimo 12 caracteres')`, 'formulario de registro'))
results.push(await step('08-404', '/esta-ruta-no-existe', `document.body.innerText.includes('Esta página no existe')`, 'ruta desconocida'))
results.push(await step('09-guard-panel', '/panel', `document.querySelector('input[type=password]')`, 'guard: /panel sin sesión manda a /entrar'))
results.push(await step('09b-guard-admin-anon', '/admin', `document.querySelector('input[type=password]')`, 'guard: /admin sin sesión manda a /entrar'))
results.push(await step('09c-guard-carrito-anon', '/carrito', `document.querySelector('input[type=password]')`, 'guard: /carrito sin sesión manda a /entrar'))
results.push(await step('09d-guard-pedidos-anon', '/pedidos', `document.querySelector('input[type=password]')`, 'guard: /pedidos sin sesión manda a /entrar'))

await evaluate(`localStorage.setItem('mkt.access', ${JSON.stringify(ACCESS)}); localStorage.setItem('mkt.refresh', ${JSON.stringify(REFRESH)}); true`)

results.push(await step('10-panel', '/panel', `document.body.innerText.includes('Jarrón de barro')`, 'panel de vendedor con sesión'))
results.push(await step('11-panel-tienda', '/panel/tienda', `document.body.innerText.includes('barro-y-talavera')`, 'ajustes de tienda'))
results.push(await step('12-producto-nuevo', '/panel/productos/nuevo', `document.body.innerText.includes('Variantes')`, 'alta de producto', true))
results.push(await step('13-producto-editar', `/panel/productos/${EDIT_ID}`, `document.body.innerText.includes('Plato de talavera') && [...document.querySelectorAll('input')].some(i => i.value === 'Azul cobalto') && [...document.querySelectorAll('input')].some(i => i.value === '340')`, 'edición: variantes y precios en pesos', true))
results.push(await step('14-cuenta', '/cuenta', `[...document.querySelectorAll('input')].some(i => i.value === 'Lucía Márquez') && document.body.innerText.includes('panel@tonala.mx')`, 'cuenta con perfil precargado'))

results.push(await step('15-vender-redirige', '/vender', `document.body.innerText.includes('Productos')`, 'guard: /vender con tienda manda a /panel'))

results.push(await step('15b-carrito', '/carrito', `document.body.innerText.includes('carrito')`, 'carrito con sesión'))
results.push(await step('15c-envios', '/panel/envios', `[...document.querySelectorAll('input')].some(i => i.value === '149')`, 'tarifas de envío del vendedor', true))
results.push(await step('15d-pedidos', '/pedidos', `document.body.innerText.includes('pedidos') || document.body.innerText.includes('comprado')`, 'lista de pedidos'))
results.push(await step('15h-mensajes', '/mensajes', `document.body.innerText.includes('Mensajes') || document.body.innerText.includes('conversaciones')`, 'bandeja de mensajes'))
results.push(await step('15e-ventas', '/panel/ventas', `document.body.innerText.includes('Ventas')`, 'ventas del vendedor'))
results.push(await step('15f-pagos', '/panel/pagos', `document.body.innerText.includes('Listo para depositar')`, 'pagos del vendedor', true))
results.push(await step('15g-aclaraciones', '/panel/aclaraciones', `document.body.innerText.includes('Aclaraciones')`, 'aclaraciones del vendedor'))
results.push(await step('16-admin-no-es-staff', '/admin', `document.body.innerText.includes('Esta página no existe')`, 'guard: un vendedor ve 404 en /admin'))

await evaluate(`localStorage.setItem('mkt.access', ${JSON.stringify(ADMIN_ACCESS)}); localStorage.setItem('mkt.refresh', ${JSON.stringify(ADMIN_REFRESH)}); true`)

results.push(await step('17-admin-cola', '/admin', `document.body.innerText.includes('Alebrijes de Oaxaca') && document.body.innerText.includes('pendiente@tonala.mx')`, 'cola de revisión con la tienda pendiente'))
results.push(await step('18-admin-activas', '/admin?estado=active', `document.body.innerText.includes('Barro y Talavera') && !document.body.innerText.includes('Alebrijes')`, 'filtro por estado'))
results.push(await step('19-admin-busqueda', '/admin?estado=all&q=alebrijes', `document.body.innerText.includes('Alebrijes de Oaxaca') && !document.body.innerText.includes('Barro y Talavera')`, 'búsqueda por nombre, slug o correo'))
results.push(await step('19b-admin-aclaraciones', '/admin/aclaraciones', `document.body.innerText.includes('el pago de esa venta queda congelado')`, 'aclaraciones de plataforma'))
results.push(await step('20-admin-bitacora', '/admin/bitacora', `document.body.innerText.includes('Bitácora')`, 'bitácora'))

console.log(`\n${results.filter(Boolean).length}/${results.length} pantallas sin errores`)

ws.close()
chrome.kill()
process.exit(results.every(Boolean) ? 0 : 1)
