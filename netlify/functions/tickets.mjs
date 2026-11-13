import { timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";

const jsonResponse = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

function hasValidPassword(request) {
  const expected = process.env.ORGANIZER_PASSWORD;
  const provided = request.headers.get("x-organizer-password") || "";
  if (!expected) return null;

  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes);
}

function isValidTicket(ticket) {
  return ticket &&
    typeof ticket === "object" &&
    /^TKT-[A-Z0-9-]{1,60}$/.test(ticket.id) &&
    typeof ticket.name === "string" && ticket.name.trim().length > 0 && ticket.name.length <= 100 &&
    typeof ticket.surname === "string" && ticket.surname.trim().length > 0 && ticket.surname.length <= 100 &&
    ["3A", "3B", "3C", "3D", "3E"].includes(ticket.class) &&
    ["Pagato", "Da Pagare"].includes(ticket.payment) &&
    typeof ticket.checkedIn === "boolean" &&
    typeof ticket.notes === "string" && ticket.notes.length <= 500 &&
    typeof ticket.hasSupervisor === "boolean" &&
    typeof ticket.parentName === "string" && ticket.parentName.length <= 120 &&
    typeof ticket.parentPhone === "string" && ticket.parentPhone.length <= 40 &&
    typeof ticket.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ticket.date);
}

function getTicketStore() {
  return getStore({
    name: "party-tickets-2026",
    region: "eu-central-1",
    consistency: "strong",
  });
}

export default async function handler(request) {
  const passwordValid = hasValidPassword(request);
  if (passwordValid === null) {
    return jsonResponse({ error: "Configurare ORGANIZER_PASSWORD su Netlify." }, 503);
  }
  if (!passwordValid) return jsonResponse({ error: "Codice organizzatori non valido." }, 401);

  try {
    if (request.method === "GET") {
      const store = getTicketStore();
      const { blobs } = await store.list({ prefix: "ticket:" });
      const tickets = await Promise.all(
        blobs.map(({ key }) => store.get(key, { type: "json", consistency: "strong" }))
      );
      return jsonResponse(tickets.filter(Boolean));
    }

    if (request.method === "POST") {
      const ticket = await request.json();
      if (!isValidTicket(ticket)) return jsonResponse({ error: "Dati biglietto non validi." }, 400);

      const store = getTicketStore();
      const { modified } = await store.setJSON(`ticket:${ticket.id}`, ticket, { onlyIfNew: true });
      if (!modified) return jsonResponse({ error: "Codice biglietto già esistente." }, 409);
      return jsonResponse(ticket, 201);
    }

    if (request.method === "PATCH") {
      const { id, updates } = await request.json();
      if (typeof id !== "string" || !/^TKT-[A-Z0-9-]{1,60}$/.test(id) ||
          !updates || typeof updates !== "object" || Array.isArray(updates)) {
        return jsonResponse({ error: "Aggiornamento non valido." }, 400);
      }

      const allowedKeys = Object.keys(updates);
      if (allowedKeys.length === 0 || allowedKeys.some((key) => !["payment", "checkedIn"].includes(key)) ||
          (updates.payment !== undefined && !["Pagato", "Da Pagare"].includes(updates.payment)) ||
          (updates.checkedIn !== undefined && typeof updates.checkedIn !== "boolean")) {
        return jsonResponse({ error: "Aggiornamento non valido." }, 400);
      }

      const store = getTicketStore();
      const key = `ticket:${id}`;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const current = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
        if (!current) return jsonResponse({ error: "Biglietto non trovato." }, 404);
        if (updates.checkedIn === true && current.data.checkedIn) {
          return jsonResponse({ error: "Biglietto già convalidato." }, 409);
        }

        const ticket = { ...current.data, ...updates };
        const { modified } = await store.setJSON(key, ticket, { onlyIfMatch: current.etag });
        if (modified) return jsonResponse(ticket);
      }

      return jsonResponse({ error: "Biglietto modificato da un altro operatore. Ricaricare e riprovare." }, 409);
    }

    if (request.method === "DELETE") {
      const { id } = await request.json().catch(() => ({}));
      const store = getTicketStore();
      if (id === undefined) {
        await store.deleteAll();
        return jsonResponse({ deleted: true });
      }
      if (typeof id !== "string" || !/^TKT-[A-Z0-9-]{1,60}$/.test(id)) {
        return jsonResponse({ error: "Codice biglietto non valido." }, 400);
      }
      await store.delete(`ticket:${id}`);
      return jsonResponse({ deleted: true });
    }

    return jsonResponse({ error: "Metodo non supportato." }, 405);
  } catch (error) {
    console.error("Ticket API error:", error);
    return jsonResponse({ error: "Errore durante l'accesso ai dati." }, 500);
  }
}

export const config = { path: "/api/tickets" };