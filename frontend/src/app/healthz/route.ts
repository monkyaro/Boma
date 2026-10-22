// Container health check (Docker / Nginx). Static, so it never touches the API.
export async function GET() {
  return Response.json({ status: "ok" });
}
