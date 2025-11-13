export const API_URL = "http://localhost:4000";

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const url = `${API_URL}${path}`;

  console.log("REQUEST →", url); // DEBUG

  const res = await fetch(url, {
    ...options,
    headers
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || "Erro na requisição");
  }

  return res.json();
}
