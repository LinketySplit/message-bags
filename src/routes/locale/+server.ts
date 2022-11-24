import { redirect } from "@sveltejs/kit";
import { setLocale } from "../cookie";
import type { RequestEvent } from "./$types";

export const GET = (event: RequestEvent ) => {
  setLocale(event, event.url.searchParams.get('locale') || 'en');
  throw redirect(303, event.url.searchParams.get('redirect') || '/')
}