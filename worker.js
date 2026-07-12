// Cloudflare Worker: Битрикс24 открывает локальное приложение POST-запросом,
// а статика отдаётся только по GET — переигрываем метод, сохраняя URL и query.
export default {
  async fetch(request, env) {
    if (request.method === 'POST') {
      return env.ASSETS.fetch(new Request(request.url, { method: 'GET' }));
    }
    return env.ASSETS.fetch(request);
  },
};
