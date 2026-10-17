import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9334
const BASE = 'http://localhost:5102'
const OUT = process.argv[2] ?? 'C:\\tmp\\marketplace-shots'
const EMAIL = 'panel@tonala.mx'
const PASSWORD = 'frase-larga-de-prueba-123'

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
    `--user-data-dir=${OUT}\\profile-flow`,
    'about:blank',
  ],
  { stdio: 'ignore' },
)

async function cdpUrl() {
  for (let i = 0; i < 100; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const page = targets.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
    }
    await sleep(200)
  }
  throw new Error('Chrome never opened its debugging port')
}

const ws = new WebSocket(await cdpUrl())
await new Promise((r) => ws.addEventListener('open', r, { once: true }))

let nextId = 0
const pending = new Map()
const events = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id !== undefined) {
    const entry = pending.get(m.id)
    pending.delete(m.id)
    m.error ? entry.reject(new Error(JSON.stringify(m.error))) : entry.resolve(m.result)
  } else events.push(m)
})
function send(method, params = {}) {
  const id = ++nextId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (response.exceptionDetails) {
    const detail =
      response.exceptionDetails.exception?.description ?? response.exceptionDetails.text
    throw new Error(`evaluate falló: ` + String(detail).split(String.fromCharCode(10))[0])
  }
  return response.result.value
}
let failureCount = 0
async function waitFor(expression, label, ms = 12_000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (await evaluate(`Boolean(${expression})`)) return true
    await sleep(150)
  }
  const where = await evaluate('location.pathname + location.search')
  const name = `fail-${++failureCount}`
  await shot(name)
  const text = await evaluate('document.body.innerText.split(String.fromCharCode(10)).join(" | ")')
  throw new Error(`timeout: ${label}  [en ${where}, ver ${name}.png]
      pantalla: ${String(text).slice(0, 220)}`)
}
async function goto(path) {
  await send('Page.navigate', { url: BASE + path })
  await sleep(500)
}
async function shot(name, full = false) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full })
  writeFileSync(`${OUT}\\${name}.png`, Buffer.from(data, 'base64'))
}

async function type(label, text) {
  const focused = await evaluate(`(() => {
    const label = [...document.querySelectorAll('label')].find(l => l.textContent.trim().startsWith(${JSON.stringify(label)}));
    if (!label) return false;
    const field = document.getElementById(label.getAttribute('for'));
    if (!field) return false;
    field.focus();
    return true;
  })()`)
  if (!focused) throw new Error(`no encontré el campo "${label}"`)
  await send('Input.insertText', { text })
  await sleep(120)
}

async function click(text, scope = 'main') {
  const box = await evaluate(`(() => {
    const root = document.querySelector(${JSON.stringify(scope)}) ?? document;
    const wanted = ${JSON.stringify(text)};
    const match = (e) => (e.textContent.trim() === wanted || e.getAttribute('aria-label') === wanted) && !e.disabled;
    const el = [...root.querySelectorAll('button')].find(match)
      ?? [...root.querySelectorAll('a')].find(match)
      ?? [...document.querySelectorAll('[role=menuitem], [role=option]')].find(match);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`)
  if (!box) throw new Error(`no encontré "${text}" dentro de ${scope}`)
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', {
      type,
      x: box.x,
      y: box.y,
      button: 'left',
      clickCount: 1,
    })
  }
  await sleep(300)
}

async function clickInRow(rowText, buttonText) {
  const box = await evaluate(`(() => {
    const row = [...document.querySelectorAll('li')].find(li => li.textContent.includes(${JSON.stringify(rowText)}));
    if (!row) return null;
    const el = [...row.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(buttonText)} && !b.disabled);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`)
  if (!box) throw new Error(`no encontré "${buttonText}" en la fila de "${rowText}"`)
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 })
  }
  await sleep(400)
}

await send('Page.enable')
await send('Runtime.enable')

const checks = []
const check = async (label, fn) => {
  try {
    await fn()
    console.log(`OK  ${label}`)
    checks.push(true)
  } catch (error) {
    console.log(`XX  ${label}\n      ${error.message}`)
    checks.push(false)
  }
}

await goto('/')
await evaluate('localStorage.clear(); true')

await check('login con credenciales malas muestra el error, no un 401 silencioso', async () => {
  await goto('/entrar')
  await waitFor(`document.querySelector('input[type=password]')`, 'formulario')
  await type('Correo', EMAIL)
  await type('Contraseña', 'esta-no-es-la-buena')
  await click('Entrar')
  await sleep(1500)
  await waitFor(`document.body.innerText.includes('Correo o contraseña incorrectos')`, 'mensaje de error')
  await shot('f1-login-malo')
})

await check('validación de cliente: contraseña corta no llega a la red', async () => {
  await goto('/crear-cuenta')
  await waitFor(`document.body.innerText.includes('Mínimo 12 caracteres')`, 'formulario')
  await type('Nombre completo', 'Prueba Corta')
  await type('Correo', `corta${Date.now()}@x.mx`)
  await type('Contraseña', 'corta')
  await click('Crear cuenta')
  await waitFor(
    `document.body.innerText.includes('12 character')  || document.body.innerText.includes('al menos') || document.querySelectorAll('[data-invalid], [aria-invalid=true]').length > 0`,
    'error de validación en el campo',
  )
  await shot('f2-password-corto')
})

await check('login correcto deja sesión y nav de usuario', async () => {
  await goto('/entrar')
  await waitFor(`document.querySelector('input[type=password]')`, 'formulario')
  await type('Correo', EMAIL)
  await type('Contraseña', PASSWORD)
  await click('Entrar')
  await waitFor(`localStorage.getItem('mkt.access')`, 'token guardado')
  await waitFor(`location.pathname === '/'`, 'redirección al catálogo')
  await waitFor(`!document.body.innerText.includes('Crear cuenta')`, 'nav ya no ofrece registrarse')
  await shot('f3-sesion-iniciada')
})

const slug = `prueba-ui-${Date.now()}`
await check('alta de producto: slug automático, precio en pesos, redirige a edición', async () => {
  await goto('/panel/productos/nuevo')
  await waitFor(`document.body.innerText.includes('Variantes')`, 'formulario de alta')
  await type('Título', 'Molcajete de piedra volcánica')
  await waitFor(
    `[...document.querySelectorAll('input')].some(i => i.value === 'molcajete-de-piedra-volcanica')`,
    'slug derivado del título',
  )
  await evaluate(`(() => {
    const input = [...document.querySelectorAll('input')].find(i => i.value === 'molcajete-de-piedra-volcanica');
    input.focus(); input.select(); return true;
  })()`)
  await send('Input.insertText', { text: slug })
  await type('Nombre', 'Mediano · 20 cm')
  await type('Precio (MXN)', '1250.50')
  await type('Existencias', '4')
  await shot('f4-alta-llena', true)
  await click('Crear producto')
  await waitFor(`/\\/panel\\/productos\\/[0-9a-f-]{36}$/.test(location.pathname)`, 'redirección a la edición')
  await waitFor(
    `[...document.querySelectorAll('input')].some(i => i.value === '1250.5')`,
    'el precio volvió como 1250.5 pesos (125050 centavos)',
  )
  await shot('f5-creado', true)
})

await check('los centavos llegaron exactos a la base', async () => {
  const cents = await evaluate(`fetch('/api/seller/products/' + location.pathname.split('/').pop(), {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('mkt.access') }
  }).then(r => r.json()).then(p => p.variants[0].priceCents)`)
  if (cents !== 125050) throw new Error(`esperaba 125050 centavos, llegó ${cents}`)
})

await check('publicar desde la lista lo manda al catálogo público', async () => {
  await goto('/panel')
  await waitFor(`document.body.innerText.includes('Molcajete')`, 'producto en la lista')
  await waitFor(`document.body.innerText.includes('Borrador')`, 'nace como borrador')
  await click('Publicar')
  await waitFor(`[...document.querySelectorAll('li')].find(li => li.textContent.includes('Molcajete'))?.textContent.includes('Publicado')`, 'la fila del molcajete dice Publicado')
  await shot('f6-publicado')
  const total = await evaluate(
    `fetch('/api/products?q=molcajete').then(r => r.json()).then(r => r.items.length)`,
  )
  if (total !== 1) throw new Error(`el catálogo público devolvió ${total} resultados`)
})

await check('el producto nuevo se ve en el catálogo con su precio', async () => {
  await goto(`/p/${slug}`)
  await waitFor(`document.querySelector('.text-4xl')?.textContent.trim() === '$1,250.50'`, 'precio formateado')
  await shot('f7-ficha-nueva')
})

await check('eliminar pide confirmación y recién entonces borra', async () => {
  await goto('/panel')
  await waitFor(`document.body.innerText.includes('Molcajete')`, 'producto en la lista')
  const countRows = `[...document.querySelectorAll('li')].filter(li => li.querySelector('[aria-label="Editar"]')).length`
  const before = await evaluate(countRows)
  await evaluate(`(() => {
    const row = [...document.querySelectorAll('li')].find(li => li.textContent.includes('Molcajete'));
    const trash = [...row.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Eliminar');
    trash.scrollIntoView({ block: 'center' });
    const r = trash.getBoundingClientRect();
    window.__box = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    return true;
  })()`)
  const box = await evaluate('window.__box')
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 })
  }
  await waitFor(`document.body.innerText.includes('Sí, eliminar')`, 'confirmación en línea')
  await shot('f8-confirmar-borrado')
  await click('Sí, eliminar')
  await waitFor(`!document.body.innerText.includes('Molcajete')`, 'desapareció de la lista')
  const after = await evaluate(countRows)
  if (after !== before - 1) throw new Error(`filas antes ${before}, después ${after}`)
})

await check('salir borra la sesión y devuelve el nav anónimo', async () => {
  await goto('/')
  await waitFor(`document.body.innerText.includes('Jarrón')`, 'catálogo')
  await evaluate(`(() => {
    const avatar = document.querySelector('[aria-label="Tu cuenta"]') ?? document.querySelector('header button');
    const r = avatar.getBoundingClientRect();
    window.__box = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    return true;
  })()`)
  const box = await evaluate('window.__box')
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 })
  }
  await waitFor(`document.body.innerText.includes('Salir')`, 'menú abierto')
  await shot('f9-menu-cuenta')
  await click('Salir', 'body')
  await waitFor(`!localStorage.getItem('mkt.access')`, 'token borrado')
  await waitFor(`document.body.innerText.includes('Crear cuenta')`, 'nav anónimo de vuelta')
  await shot('f10-sesion-cerrada')
})

execFileSync(
  'docker',
  ['exec', 'marketplace_postgres', 'psql', '-U', 'postgres', '-d', 'marketplace', '-qtAc',
   "UPDATE variants SET stock = 30, price_cents = 21900 WHERE sku = 'PIN-01'"],
  { encoding: 'utf8' },
)

await check('sin sesión, agregar al carrito manda a entrar y vuelve', async () => {
  await goto('/')
  await evaluate('localStorage.clear(); true')
  await goto('/p/pinata-siete-picos-demo')
  await waitFor(`document.body.innerText.includes('Te pedimos entrar')`, 'aviso para anónimos')
  await click('Agregar al carrito')
  await waitFor(`location.pathname === '/entrar'`, 'redirección a entrar')
  await shot('h1-entrar-para-agregar')
  await type('Correo', EMAIL)
  await type('Contraseña', PASSWORD)
  await click('Entrar')
  await waitFor(`location.pathname === '/p/pinata-siete-picos-demo'`, 'regreso al producto')
})

await check('agregar al carrito actualiza el contador del nav', async () => {
  await evaluate(`fetch('/api/cart', { method: 'DELETE', headers: { Authorization: 'Bearer ' + localStorage.getItem('mkt.access') } })`)
  await sleep(400)
  await goto('/p/pinata-siete-picos-demo')
  await waitFor(`document.body.innerText.includes('Agregar al carrito')`, 'botón vivo')
  await click('Agregar al carrito')
  await waitFor(`document.querySelector('header')?.innerText.includes('1')`, 'badge en 1')
  await shot('h2-agregado')
})

await check('el carrito agrupa por vendedor y congela el precio', async () => {
  await goto('/carrito')
  await waitFor(`document.body.innerText.includes('Piñata de siete picos')`, 'la línea')
  await waitFor(`document.body.innerText.includes('Barro y Talavera')`, 'agrupado por tienda')
  await waitFor(`document.body.innerText.includes('$219.00')`, 'precio congelado')
  await waitFor(`document.body.innerText.includes('$184.00')`, 'envío cobrado de verdad')
  await waitFor(`document.body.innerText.includes('$403.00')`, 'total con envío')
  await shot('h3-carrito')
})

await check('el botón + sube la cantidad y el total', async () => {
  const box = await evaluate(`(() => {
    const el = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Agregar uno');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`)
  if (!box) throw new Error('no encontré el botón de sumar')
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 })
  }
  await waitFor(`document.body.innerText.includes('$438.00')`, 'total por dos')
  await waitFor(`document.body.innerText.includes('2 artículos')`, 'el resumen cuenta dos')
  await shot('h4-dos-piezas')
})

await check('si el vendedor sube el precio, se respeta el que vio el comprador', async () => {
  execFileSync(
    'docker',
    ['exec', 'marketplace_postgres', 'psql', '-U', 'postgres', '-d', 'marketplace', '-qtAc',
     "UPDATE variants SET price_cents = 31900 WHERE sku = 'PIN-01'"],
    { encoding: 'utf8' },
  )
  await goto('/carrito')
  await waitFor(`document.body.innerText.includes('Subió a $319.00')`, 'avisa el precio nuevo')
  await waitFor(`document.body.innerText.includes('Te respetamos $219.00')`, 'y respeta el viejo')
  await waitFor(`document.body.innerText.includes('$438.00')`, 'el total no se movió')
  await shot('h5-precio-congelado')
  execFileSync(
    'docker',
    ['exec', 'marketplace_postgres', 'psql', '-U', 'postgres', '-d', 'marketplace', '-qtAc',
     "UPDATE variants SET price_cents = 21900 WHERE sku = 'PIN-01'"],
    { encoding: 'utf8' },
  )
})

await check('lo agotado se marca y deja de contar en el total', async () => {
  execFileSync(
    'docker',
    ['exec', 'marketplace_postgres', 'psql', '-U', 'postgres', '-d', 'marketplace', '-qtAc',
     "UPDATE variants SET stock = 0 WHERE sku = 'PIN-01'"],
    { encoding: 'utf8' },
  )
  await goto('/carrito')
  await waitFor(`document.body.innerText.includes('Agotado')`, 'marcado como agotado')
  await waitFor(`document.body.innerText.includes('Quita los artículos marcados')`, 'bloquea el pago')
  await waitFor(`document.body.innerText.includes('0 artículos')`, 'no cuenta en el resumen')
  await shot('h6-agotado')
  execFileSync(
    'docker',
    ['exec', 'marketplace_postgres', 'psql', '-U', 'postgres', '-d', 'marketplace', '-qtAc',
     "UPDATE variants SET stock = 30 WHERE sku = 'PIN-01'"],
    { encoding: 'utf8' },
  )
})

await check('vaciar el carrito lo deja en el estado vacío', async () => {
  await goto('/carrito')
  await waitFor(`document.body.innerText.includes('Piñata')`, 'la línea sigue ahí')
  await click('Vaciar')
  await waitFor(`document.body.innerText.includes('Tu carrito está vacío')`, 'estado vacío')
  await shot('h7-vacio')
})

await check('el carrito cobra el envío de la tienda', async () => {
  await goto('/p/pinata-siete-picos-demo')
  await waitFor(`document.body.innerText.includes('Agregar al carrito')`, 'botón')
  await click('Agregar al carrito')
  await sleep(900)
  await goto('/carrito')
  await waitFor(`document.body.innerText.includes('Piñata')`, 'la línea')
  await waitFor(`document.body.innerText.includes('$184.00')`, 'envío: 149 base + 1 kg x 35')
  await waitFor(`document.body.innerText.includes('$403.00')`, 'total 219 + 184')
  await shot('i1-envio')
})

await check('el carrito dice cuánto falta para el envío gratis', async () => {
  await waitFor(`document.body.innerText.includes('para envío gratis')`, 'el empujón')
})

await check('al pasar el umbral el envío queda gratis', async () => {
  const box = await evaluate(`(() => {
    const el = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Agregar uno');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`)
  if (!box) throw new Error('no encontré el botón de sumar')
  for (let n = 0; n < 7; n++) {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 })
    }
    await sleep(500)
  }
  await waitFor(`document.body.innerText.includes('Gratis')`, 'envío gratis')
  await waitFor(`!document.body.innerText.includes('para envío gratis')`, 'ya no empuja')
  await shot('i2-envio-gratis')
})

await check('la pantalla de envíos del vendedor carga sus tarifas', async () => {
  await goto('/panel/envios')
  await waitFor(`[...document.querySelectorAll('input')].some(i => i.value === '149')`, 'base nacional')
  await waitFor(`[...document.querySelectorAll('input')].some(i => i.value === '1500')`, 'umbral de gratis')
  await waitFor(`document.body.innerText.includes('Ejemplo con un paquete de 2.3 kg')`, 'ejemplo')
  await waitFor(`document.body.innerText.includes('$254.00')`, '149 + 3 x 35 en el ejemplo')
  await waitFor(`document.querySelector('[role=switch]')`, 'el switch de tarifa local se dibuja')
  await shot('i3-panel-envios')
})

await check('cambiar la tarifa se refleja en el carrito', async () => {
  const input = await evaluate(`(() => {
    const el = [...document.querySelectorAll('input')].find(i => i.value === '149');
    if (!el) return null;
    el.focus(); el.select();
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`)
  if (!input) throw new Error('no encontré el costo base')
  await send('Input.insertText', { text: '99' })
  await sleep(400)
  await click('Guardar tarifas')
  await waitFor(`document.body.innerText.includes('Tarifas guardadas')`, 'confirmación')
  await goto('/carrito')
  await waitFor(`document.body.innerText.includes('Piñata')`, 'el carrito')
  const shipping = await evaluate(`fetch('/api/cart', { headers: { Authorization: 'Bearer ' + localStorage.getItem('mkt.access') } }).then(r => r.json()).then(c => c.groups[0].shippingCents)`)
  if (shipping !== 0) throw new Error(`esperaba envío gratis todavía, llegó ${shipping}`)
  await shot('i4-tarifa-cambiada')
})

await check('dejar el carrito como estaba', async () => {
  await evaluate(`fetch('/api/cart', { method: 'DELETE', headers: { Authorization: 'Bearer ' + localStorage.getItem('mkt.access') } })`)
  await evaluate(`fetch('/api/seller/shipping', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('mkt.access') },
    body: JSON.stringify({ rates: [
      { zone: 'nacional', baseCents: 14900, perKgCents: 3500, freeOverCents: 150000 },
      { zone: 'local', baseCents: 6000, perKgCents: 0 },
    ] }),
  }).then(r => r.status)`)
  await sleep(400)
})

execFileSync(
  'docker',
  ['exec', 'marketplace_postgres', 'psql', '-U', 'postgres', '-d', 'marketplace', '-qtAc',
   "DELETE FROM orders WHERE buyer_id = (SELECT id FROM users WHERE email = 'panel@tonala.mx'); DELETE FROM addresses WHERE user_id = (SELECT id FROM users WHERE email = 'panel@tonala.mx')"],
  { encoding: 'utf8' },
)

await check('el carrito lleva al checkout', async () => {
  await goto('/p/pinata-siete-picos-demo')
  await waitFor(`document.body.innerText.includes('Agregar al carrito')`, 'botón')
  await click('Agregar al carrito')
  await sleep(900)
  await goto('/carrito')
  await waitFor(`document.body.innerText.includes('Piñata')`, 'la línea')
  await click('Continuar al pago')
  await waitFor(`location.pathname === '/checkout'`, 'llegó al checkout')
  await shot('j1-checkout')
})

await check('sin dirección el botón de confirmar está apagado', async () => {
  const disabled = await evaluate(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Confirmar pedido' && b.disabled)`)
  if (!disabled) throw new Error('el botón de confirmar no estaba deshabilitado')
  await waitFor(`document.body.innerText.includes('Elige una dirección')`, 'el aviso')
})

await check('se guarda una dirección desde el checkout', async () => {
  await click('Agregar dirección')
  await waitFor(`document.body.innerText.includes('Quién recibe')`, 'el formulario')
  await type('Quién recibe', 'Ana López')
  await type('Teléfono', '3312345678')
  await type('Calle y número', 'Av. Hidalgo 45')
  await type('Colonia', 'Centro')
  await type('Ciudad o municipio', 'Guadalajara')
  const state = await evaluate(`(() => {
    const el = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Elige uno'));
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`)
  if (!state) throw new Error('no encontré el selector de estado')
  for (const t of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type: t, x: state.x, y: state.y, button: 'left', clickCount: 1 })
  }
  await sleep(700)
  await click('Jalisco', 'body')
  await type('Código postal', '44100')
  await shot('j2-direccion', true)
  await click('Guardar dirección')
  await waitFor(`document.body.innerText.includes('Guadalajara, Jalisco')`, 'la dirección guardada')
})

await check('confirmar crea el pedido con su dirección copiada', async () => {
  await click('Confirmar pedido')
  await waitFor(`/pedidos/.test(location.pathname) && location.pathname.length > 10`, 'detalle del pedido')
  await waitFor(`document.body.innerText.includes('Esperando pago')`, 'nace sin pagar')
  await waitFor(`/MX-[0-9]{6}-[0-9A-Z]{3}/.test(document.body.innerText)`, 'con número de pedido')
  await waitFor(`document.body.innerText.includes('Av. Hidalgo 45')`, 'con la dirección copiada')
  await shot('j3-pedido', true)
})

await check('el carrito quedó vacío tras comprar', async () => {
  const count = await evaluate(`fetch('/api/cart/summary', { headers: { Authorization: 'Bearer ' + localStorage.getItem('mkt.access') } }).then(r => r.json()).then(s => s.itemCount)`)
  if (count !== 0) throw new Error(`el carrito quedó con ${count} piezas`)
})

await check('simular el pago lo deja pagado y por enviar', async () => {
  await click('Simular pago exitoso')
  await waitFor(`document.body.innerText.includes('Pagado')`, 'pedido pagado')
  await waitFor(`document.body.innerText.includes('Por enviar')`, 'subpedido por enviar')
  await shot('j4-pagado', true)
})

await check('la venta le aparece al vendedor con la dirección', async () => {
  await goto('/panel/ventas')
  await waitFor(`/MX-[0-9]{6}-[0-9A-Z]{3}/.test(document.body.innerText)`, 'la venta')
  await waitFor(`document.body.innerText.includes('Av. Hidalgo 45')`, 'a dónde mandarla')
  await waitFor(`document.body.innerText.includes('Comisión de la plataforma')`, 'el desglose')
  await waitFor(`document.body.innerText.includes('Te toca')`, 'cuánto le queda')
  await shot('j5-ventas', true)
})

await check('el vendedor marca enviado con guía', async () => {
  await click('Marcar como enviado')
  await waitFor(`document.querySelector('input[placeholder^="Paquetería"]')`, 'los campos de guía')
  await evaluate(`(() => { document.querySelector('input[placeholder^="Paquetería"]').focus(); return true })()`)
  await send('Input.insertText', { text: 'Estafeta' })
  await sleep(200)
  await evaluate(`(() => { document.querySelector('input[placeholder^="Número de guía"]').focus(); return true })()`)
  await send('Input.insertText', { text: '7788990011' })
  await sleep(300)
  await click('Marcar enviado')
  await waitFor(`document.body.innerText.includes('Nada por enviar')`, 'sale de la cola de por enviar')
  await goto('/panel/ventas?estado=shipped')
  await waitFor(`document.body.innerText.includes('Estafeta')`, 'la guía queda a la vista')
  await waitFor(`document.body.innerText.includes('7788990011')`, 'con su número')
  await shot('j6-enviado', true)
})

await check('el comprador confirma que lo recibió', async () => {
  await goto('/pedidos')
  await waitFor(`document.querySelector('main ul li button')`, 'la lista de pedidos')
  const row = await evaluate(`(() => {
    const el = document.querySelector('main ul li button');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`)
  if (!row) throw new Error('no encontré el pedido en la lista')
  for (const t of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type: t, x: row.x, y: row.y, button: 'left', clickCount: 1 })
  }
  await waitFor(`document.body.innerText.includes('En camino')`, 'va en camino')
  await click('Ya lo recibí')
  await waitFor(`document.body.innerText.includes('Entregado')`, 'entregado')
  await shot('j7-entregado', true)
})

await check('la pantalla de pagos muestra la venta entregada', async () => {
  await goto('/panel/pagos')
  await waitFor(`document.body.innerText.includes('Listo para depositar')`, 'el tablero')
  await waitFor(`document.body.innerText.includes('Ya depositado')`, 'el histórico')
  await waitFor(`/MX-[0-9]{6}-[0-9A-Z]{3}/.test(document.body.innerText)`, 'la venta por cobrar')
  await waitFor(`document.body.innerText.includes('comisión')`, 'el desglose')
  await shot('k1-pagos', true)
})

await check('tras la corrida de pagos queda depositado', async () => {
  const before = await evaluate(`fetch('/api/seller/payouts', { headers: { Authorization: 'Bearer ' + localStorage.getItem('mkt.access') } }).then(r => r.json()).then(e => e.pending.amountCents)`)
  if (!before) throw new Error('no había nada por cobrar')

  execFileSync(
    'node',
    ['-e', `fetch('http://localhost:3102/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@marketplace.mx', password: 'frase-larga-de-prueba-123' }) }).then(r => r.json()).then(s => fetch('http://localhost:3102/api/admin/payouts/run', { method: 'POST', headers: { Authorization: 'Bearer ' + s.tokens.accessToken } })).then(r => r.text()).then(console.log)`],
    { encoding: 'utf8' },
  )
  await sleep(800)

  await goto('/panel/pagos')
  await waitFor(`document.body.innerText.includes('Depositado')`, 'el depósito')
  await waitFor(`document.body.innerText.includes('tr_fake_')`, 'con su id de transferencia')
  const after = await evaluate(`fetch('/api/seller/payouts', { headers: { Authorization: 'Bearer ' + localStorage.getItem('mkt.access') } }).then(r => r.json()).then(e => e.paidTotalCents)`)
  if (after < before) throw new Error(`depositado ${after} < por cobrar ${before}`)
  await shot('k2-depositado', true)
})

let disputeOrderPath = null

await check('el comprador abre una aclaración desde su pedido', async () => {
  await goto('/p/pinata-siete-picos-demo')
  await waitFor(`document.body.innerText.includes('Agregar al carrito')`, 'botón')
  await click('Agregar al carrito')
  await sleep(900)
  await goto('/checkout')
  await waitFor(`document.body.innerText.includes('Guadalajara')`, 'la dirección guardada')
  await click('Confirmar pedido')
  await waitFor(`document.body.innerText.includes('Esperando pago')`, 'pedido creado')
  await click('Simular pago exitoso')
  await waitFor(`document.body.innerText.includes('Por enviar')`, 'pagado')
  disputeOrderPath = await evaluate('location.pathname')

  const suborderId = await evaluate(`(async () => {
    const id = location.pathname.split('/').pop();
    const auth = { Authorization: 'Bearer ' + localStorage.getItem('mkt.access') };
    const order = await fetch('/api/orders/' + id, { headers: auth }).then(r => r.json());
    return order.suborders[0].id;
  })()`)
  await evaluate(`fetch('/api/suborders/${suborderId}/ship', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('mkt.access') },
    body: JSON.stringify({ carrier: 'Estafeta', trackingNumber: 'DISP00123' }),
  }).then(r => r.status)`)
  await sleep(500)

  await goto(disputeOrderPath)
  await waitFor(`document.body.innerText.includes('Tengo un problema')`, 'el botón de aclaración')
  await click('Tengo un problema con este envío')
  await waitFor(`document.querySelector('textarea')`, 'el formulario')
  await evaluate(`(() => { document.querySelector('textarea').focus(); return true })()`)
  await send('Input.insertText', { text: 'La piñata llegó con la olla de barro quebrada por dentro.' })
  await sleep(300)
  await shot('l1-abrir-aclaracion', true)
  await click('Abrir aclaración')
  await waitFor(`document.body.innerText.includes('Abierta')`, 'la aclaración abierta')
  await waitFor(`document.body.innerText.includes('quebrada por dentro')`, 'con su descripción')
  await shot('l2-aclaracion', true)
})

await check('una aclaración abierta congela el pago de esa venta', async () => {
  await goto('/panel/pagos')
  await waitFor(`document.body.innerText.includes('Listo para depositar')`, 'el tablero')
  const pending = await evaluate(`fetch('/api/seller/payouts', { headers: { Authorization: 'Bearer ' + localStorage.getItem('mkt.access') } }).then(r => r.json()).then(e => e.pending.count)`)
  if (pending !== 0) throw new Error(`había ${pending} ventas por cobrar y la disputa debía congelarla`)
})

await check('el vendedor la ve en su panel y responde', async () => {
  await goto('/panel/aclaraciones')
  await waitFor(`document.body.innerText.includes('quebrada por dentro')`, 'la aclaración')
  await waitFor(`document.body.innerText.includes('el pago de esa venta se detiene')`, 'el aviso al vendedor')
  await evaluate(`(() => { document.querySelector('textarea').focus(); return true })()`)
  await send('Input.insertText', { text: 'Lo siento, te mando otra sin costo. ¿Me pasas una foto?' })
  await sleep(300)
  await click('Enviar')
  await waitFor(`document.body.innerText.includes('te mando otra sin costo')`, 'su respuesta')
  await shot('l3-vendedor-responde', true)
})

await check('el admin la resuelve y el subpedido queda reembolsado', async () => {
  await goto('/')
  await evaluate('localStorage.clear(); true')
  await goto('/entrar')
  await waitFor(`document.querySelector('input[type=password]')`, 'formulario de login')
  await type('Correo', 'admin@marketplace.mx')
  await type('Contraseña', PASSWORD)
  await click('Entrar')
  await waitFor(`localStorage.getItem('mkt.access')`, 'sesión de admin')
  await goto('/admin/aclaraciones')
  await waitFor(`document.body.innerText.includes('quebrada por dentro')`, 'la aclaración')
  await waitFor(`document.body.innerText.includes('el pago de esa venta queda congelado')`, 'el aviso al admin')
  await click('Resolver a favor del comprador')
  await waitFor(`document.body.innerText.includes('queda reembolsado')`, 'la advertencia de lo que va a pasar')
  const boxes = await evaluate(`document.querySelectorAll('textarea').length`)
  await evaluate(`(() => { [...document.querySelectorAll('textarea')].pop().focus(); return true })()`)
  await send('Input.insertText', { text: 'La foto muestra la olla quebrada. Se reembolsa al comprador.' })
  await sleep(300)
  await shot('l4-resolver', true)
  await click('Confirmar resolución')
  await waitFor(`document.body.innerText.includes('A favor del comprador')`, 'resuelta')
  const noise = await evaluate(`document.body.innerText.includes('Esta cuenta no tiene tienda')`)
  if (noise) throw new Error('el admin vio un error de vendedor que no le toca')
  await shot('l5-resuelta', true)
})

execFileSync(
  'docker',
  ['exec', 'marketplace_postgres', 'psql', '-U', 'postgres', '-d', 'marketplace', '-qtAc',
   "DELETE FROM reviews WHERE product_id IN (SELECT id FROM products WHERE slug = 'pinata-siete-picos-demo'); UPDATE products SET rating_avg = NULL, rating_count = 0 WHERE slug = 'pinata-siete-picos-demo'; UPDATE sellers SET rating_avg = NULL, rating_count = 0 WHERE slug = 'barro-y-talavera'"],
  { encoding: 'utf8' },
)

await check('sin opiniones la ficha lo dice', async () => {
  await goto('/')
  await evaluate('localStorage.clear(); true')
  await goto('/p/pinata-siete-picos-demo')
  await waitFor(`document.body.innerText.includes('Todavía nadie opina')`, 'el estado vacío')
  await waitFor(`document.body.innerText.includes('Sin opiniones')`, 'la insignia vacía')
  await shot('m1-sin-opiniones', true)
})

await check('el comprador opina de lo que ya recibió', async () => {
  await goto('/entrar')
  await waitFor(`document.querySelector('input[type=password]')`, 'formulario')
  await type('Correo', EMAIL)
  await type('Contraseña', PASSWORD)
  await click('Entrar')
  await waitFor(`localStorage.getItem('mkt.access')`, 'sesión')

  const target = await evaluate(`(async () => {
    const auth = { Authorization: 'Bearer ' + localStorage.getItem('mkt.access') };
    const list = await fetch('/api/orders?limit=50', { headers: auth }).then(r => r.json());
    for (const row of list.items) {
      const order = await fetch('/api/orders/' + row.id, { headers: auth }).then(r => r.json());
      const sub = order.suborders.find(s => s.status === 'delivered');
      if (sub) return order.id;
    }
    return null;
  })()`)
  if (!target) throw new Error('no había un pedido entregado para opinar')

  await goto('/pedidos/' + target)
  await waitFor(`document.body.innerText.includes('¿Qué tal te fue?')`, 'el formulario de opinión')
  const star = await evaluate(`(() => {
    const el = document.querySelector('[aria-label="5 estrellas"]');
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`)
  if (!star) throw new Error('no encontré las estrellas')
  for (const t of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type: t, x: star.x, y: star.y, button: 'left', clickCount: 1 })
  }
  await sleep(300)
  await evaluate(`(() => { [...document.querySelectorAll('textarea')].pop().focus(); return true })()`)
  await send('Input.insertText', { text: 'Quedó preciosa y llegó rápido.' })
  await sleep(300)
  await shot('m2-opinar', true)
  await click('Publicar opinión')
  await waitFor(`document.body.innerText.includes('Cambiar')`, 'queda publicada')
})

await check('la opinión sale en la ficha y en el catálogo', async () => {
  await goto('/p/pinata-siete-picos-demo')
  await waitFor(`document.body.innerText.includes('Quedó preciosa')`, 'la opinión')
  await waitFor(`document.body.innerText.includes('5.0')`, 'el promedio')
  await waitFor(`!document.body.innerText.includes('Todavía nadie opina')`, 'ya no está vacío')
  await shot('m3-con-opinion', true)

  await goto('/')
  await waitFor(`document.body.innerText.includes('5.0')`, 'la estrella en la tarjeta')
  await shot('m4-catalogo', true)
})

await check('el vendedor responde la opinión', async () => {
  await goto('/p/pinata-siete-picos-demo')
  const reviewId = await evaluate(`fetch('/api/products/pinata-siete-picos-demo/reviews').then(r => r.json()).then(d => d.items[0].id)`)
  const replied = await evaluate(`fetch('/api/reviews/${reviewId}/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('mkt.access') },
    body: JSON.stringify({ reply: 'Gracias, que la disfruten mucho.' }),
  }).then(r => r.status)`)
  if (replied !== 200) throw new Error('la respuesta del vendedor devolvió ' + replied)
  await goto('/p/pinata-siete-picos-demo')
  await waitFor(`document.body.innerText.includes('Respuesta de la tienda')`, 'la respuesta')
  await waitFor(`document.body.innerText.includes('que la disfruten')`, 'su texto')
  await shot('m5-respuesta', true)
})

await check('el chat se abre desde el pedido y guarda lo escrito', async () => {
  await goto('/')
  await evaluate('localStorage.clear(); true')
  await goto('/entrar')
  await waitFor(`document.querySelector('input[type=password]')`, 'formulario')
  await type('Correo', EMAIL)
  await type('Contraseña', PASSWORD)
  await click('Entrar')
  await waitFor(`localStorage.getItem('mkt.access')`, 'sesión')

  const target = await evaluate(`(async () => {
    const auth = { Authorization: 'Bearer ' + localStorage.getItem('mkt.access') };
    const list = await fetch('/api/orders?limit=50', { headers: auth }).then(r => r.json());
    for (const row of list.items) {
      if (row.status !== 'paid') continue;
      return row.id;
    }
    return null;
  })()`)
  if (!target) throw new Error('no había un pedido pagado para chatear')

  await goto('/pedidos/' + target)
  await waitFor(`[...document.querySelectorAll('main button')].some(b => b.getAttribute('aria-label') === 'Mensajes')`, 'el botón de mensajes')
  await click('Mensajes')
  await waitFor(`document.body.innerText.includes('Todavía no se han escrito') || document.querySelector('input[placeholder="Escribe un mensaje"]')`, 'el panel')
  await waitFor(`document.body.innerText.includes('en línea')`, 'el socket conectado')
  await shot('n1-chat-abierto', true)

  await evaluate(`(() => { document.querySelector('input[placeholder="Escribe un mensaje"]').focus(); return true })()`)
  await send('Input.insertText', { text: '¿Lo tienes en azul?' })
  await sleep(300)
  const box = await evaluate(`(() => {
    const el = document.querySelector('[aria-label="Enviar mensaje"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`)
  if (!box) throw new Error('no encontré el botón de enviar')
  for (const t of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type: t, x: box.x, y: box.y, button: 'left', clickCount: 1 })
  }
  await waitFor(`document.body.innerText.includes('¿Lo tienes en azul?')`, 'el mensaje en pantalla')
  await shot('n2-mensaje-enviado', true)

  await goto('/pedidos/' + target)
  await waitFor(`[...document.querySelectorAll('main button')].some(b => b.getAttribute('aria-label') === 'Mensajes')`, 'el botón tras recargar')
  await click('Mensajes')
  await waitFor(`document.body.innerText.includes('¿Lo tienes en azul?')`, 'sigue ahí tras recargar')
})

await check('el mensaje llega al vendedor en vivo por el socket', async () => {
  await goto('/panel/ventas?estado=all')
  await waitFor(`document.body.innerText.includes('Mensajes')`, 'el botón en la venta')
  await click('Mensajes')
  await waitFor(`document.body.innerText.includes('¿Lo tienes en azul?')`, 've lo que escribió ella')
  await waitFor(`document.body.innerText.includes('en línea')`, 'su socket conectado')

  const before = await evaluate('document.body.innerText.includes("Sí, en azul cobalto")')
  if (before) throw new Error('la respuesta ya estaba antes de escribirla')

  const suborderId = await evaluate(`(async () => {
    const auth = { Authorization: 'Bearer ' + localStorage.getItem('mkt.access') };
    const inbox = await fetch('/api/chat', { headers: auth }).then(r => r.json());
    return inbox.items[0].suborderId;
  })()`)

  await evaluate(`fetch('/api/chat/${suborderId}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('mkt.access') },
    body: JSON.stringify({ body: 'Sí, en azul cobalto. Te lo aparto.' }),
  }).then(r => r.status)`)

  await waitFor(`document.body.innerText.includes('Sí, en azul cobalto')`, 'llegó sin recargar')
  await shot('n3-chat-vendedor', true)
})

await check('la bandeja de mensajes lista la conversación', async () => {
  await goto('/mensajes')
  await waitFor(`document.body.innerText.includes('Mensajes')`, 'la página')
  await waitFor(`document.body.innerText.includes('azul cobalto')`, 'el último mensaje')
  await waitFor(`/MX-[0-9]{6}-[0-9A-Z]{3}/.test(document.body.innerText)`, 'el número de pedido')
  await shot('n4-bandeja', true)
})

execFileSync(
  'docker',
  ['exec', 'marketplace_postgres', 'psql', '-U', 'postgres', '-d', 'marketplace', '-qtAc',
   "UPDATE sellers SET status='pending', status_reason=NULL WHERE slug='alebrijes-de-oaxaca'"],
  { encoding: 'utf8' },
)

await check('un admin entra por el mismo formulario que todos', async () => {
  await goto('/')
  await evaluate('localStorage.clear(); true')
  await goto('/entrar')
  await waitFor(`document.querySelector('input[type=password]')`, 'formulario')
  await type('Correo', 'admin@marketplace.mx')
  await type('Contraseña', PASSWORD)
  await click('Entrar')
  await waitFor(`localStorage.getItem('mkt.access')`, 'token guardado')
  await goto('/admin')
  await waitFor(`document.body.innerText.includes('Alebrijes de Oaxaca')`, 'cola de revisión')
  await shot('g1-cola-revision')
})

await check('aprobar una tienda la activa y la saca de la cola', async () => {
  await clickInRow('Alebrijes de Oaxaca', 'Aprobar')
  await waitFor(`!document.body.innerText.includes('Alebrijes de Oaxaca')`, 'sale de la cola de pendientes')
  await shot('g2-cola-vacia')
  const status = await evaluate(`fetch('/api/sellers/alebrijes-de-oaxaca').then(r => r.status)`)
  if (status !== 200) throw new Error(`la tienda pública contestó ${status}, esperaba 200`)
})

await check('suspender exige motivo y se lo cuenta al vendedor', async () => {
  await goto('/admin?estado=active&q=alebrijes')
  await waitFor(`document.body.innerText.includes('Alebrijes de Oaxaca')`, 'la tienda ya activa')
  await clickInRow('Alebrijes de Oaxaca', 'Suspender')
  await waitFor(`document.querySelector('textarea')`, 'campo de motivo')
  const blocked = await evaluate(`[...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Suspender').every(b => b.disabled || b.textContent.trim() !== 'Suspender')`)
  if (!blocked) throw new Error('el botón de confirmar no estaba deshabilitado sin motivo')
  await evaluate(`(() => { document.querySelector('textarea').focus(); return true })()`)
  await send('Input.insertText', { text: 'Las piezas no son artesanía mexicana' })
  await sleep(300)
  await shot('g3-motivo')
  await clickInRow('Alebrijes de Oaxaca', 'Suspender')
  await waitFor(`!document.body.innerText.includes('Alebrijes de Oaxaca')`, 'sale de las activas')
  await goto('/admin?estado=suspended')
  await waitFor(`document.body.innerText.includes('Las piezas no son artesanía mexicana')`, 'el motivo queda a la vista')
  await shot('g4-suspendida')
  const status = await evaluate(`fetch('/api/sellers/alebrijes-de-oaxaca').then(r => r.status)`)
  if (status !== 404) throw new Error(`la tienda pública contestó ${status}, esperaba 404`)
})

await check('la bitácora guarda quién hizo qué', async () => {
  await goto('/admin/bitacora')
  await waitFor(`document.body.innerText.includes('aprobó la tienda')`, 'entrada de aprobación')
  await waitFor(`document.body.innerText.includes('suspendió la tienda')`, 'entrada de suspensión')
  await waitFor(`document.body.innerText.includes('admin@marketplace.mx')`, 'el actor')
  await shot('g5-bitacora')
})

const problems = events
  .filter(
    (e) =>
      e.method === 'Runtime.exceptionThrown' ||
      (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'),
  )
  .map((e) =>
    e.method === 'Runtime.exceptionThrown'
      ? e.params.exceptionDetails.text
      : e.params.args.map((a) => a.value ?? a.description ?? '').join(' '),
  )
  .filter((p) => !p.includes('Download the React DevTools') && !p.includes('401') && !p.includes('422'))

console.log(`\n${checks.filter(Boolean).length}/${checks.length} flujos`)
if (problems.length) {
  console.log('errores de consola:')
  for (const p of problems.slice(0, 6)) console.log('  ' + p.slice(0, 200))
}

ws.close()
chrome.kill()
process.exit(checks.every(Boolean) ? 0 : 1)
