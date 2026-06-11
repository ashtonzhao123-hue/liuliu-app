export interface RequestOptions extends RequestInit {
  baseUrl?: string;
}

export async function request<TResponse>(
  path: string,
  { baseUrl = import.meta.env.VITE_API_BASE_URL ?? '', headers, ...init }: RequestOptions = {}
): Promise<TResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}
