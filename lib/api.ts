import axios from "axios";

export interface NumberData {
  digits: number[];
  decimalCount: number;
  sign: 1 | -1;
}

export interface Problem {
  num1: NumberData;
  num2: NumberData;
}

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  timeout: 5000,
});

export async function fetchProblem(n1: number, n2: number, type: "integer" | "float"): Promise<Problem> {
  const { data } = await api.get<Problem>("/api/problem", { params: { n1, n2, type } });
  return data;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const { data } = await api.get<{ status: string }>("/api/health");
    return data.status === "ok";
  } catch {
    return false;
  }
}
