const PUBLIC_ROUTE_GROUP = "/(public)";

export function isPublicRoute(routeId: string | null): boolean {
  return (
    routeId !== null &&
    (routeId === PUBLIC_ROUTE_GROUP || routeId.startsWith(`${PUBLIC_ROUTE_GROUP}/`))
  );
}
