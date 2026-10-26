/// <reference types="astro/client" />

declare module 'virtual:astro-participant-auth/config' {
  export const displayName: string
}

declare module 'virtual:astro-participant-auth/global.css'

declare namespace App {
  interface Locals {
    access: import('./server/auth/access').PageAccess
  }
}
