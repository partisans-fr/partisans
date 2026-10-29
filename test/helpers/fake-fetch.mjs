// Faux fetch pour les tests : chaque route « MÉTHODE https://hôte/chemin » renvoie
// { status, body, headers }, ou une fonction qui reçoit l'appel et renvoie cette réponse.
// Tous les appels sont enregistrés dans `calls`.
export function fakeFetch(routes) {
  const calls = [];
  async function fetch(input, init = {}) {
    const url = new URL(input);
    const method = init.method ?? 'GET';
    const requestBody =
      init.body instanceof URLSearchParams ? Object.fromEntries(init.body) : init.body && JSON.parse(init.body);
    const call = { method, url, headers: init.headers ?? {}, body: requestBody };
    calls.push(call);
    const route = routes[`${method} ${url.origin}${url.pathname}`];
    if (!route) {
      return Response.json({ error: 'RouteNonSimulee', message: `${method} ${url.href}` }, { status: 404 });
    }
    const { status = 200, body = {}, headers = {} } = typeof route === 'function' ? await route(call) : route;
    return Response.json(body, { status, headers });
  }
  return { fetch, calls };
}
