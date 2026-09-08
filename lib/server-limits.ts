const creationTraffic = new Map<string, { start: number; count: number }>();
export function creationLimited(request: Request, now = Date.now()) {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const previous = creationTraffic.get(ip);
  if (!previous || now - previous.start >= 3600000) {
    if (creationTraffic.size >= 2000) creationTraffic.delete(creationTraffic.keys().next().value!);
    creationTraffic.set(ip, { start: now, count: 1 }); return false;
  }
  previous.count++; return previous.count > 20;
}
