async function parseResponse(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function requestAuth(role, action, payload) {
  const roleParam = role === "admin" ? "admin" : "student";
  const actionPath = action === "SIGNUP" ? "signup" : "signin";

  const response = await fetch(`/api/auth/${actionPath}?role=${roleParam}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        data?.message ||
          "Non autorise (401). Le backend a refuse la requete d'authentification.",
      );
    }

    throw new Error(data?.message || "Authentication failed");
  }

  return data;
}

export function signupUser(role, payload) {
  return requestAuth(role, "SIGNUP", payload);
}

export function signinUser(role, payload) {
  return requestAuth(role, "SIGNIN", payload);
}
