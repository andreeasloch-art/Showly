export type Lang = "de" | "en" | "es";
export type LText = string | { de: string; en: string; es?: string };
export type LList = string[] | { de: string[]; en: string[]; es?: string[] };

export interface Pkg { id: string; name: LText; price: number; dur?: LText; inc?: LList }
export interface Review { n: string; d: LText; r: number; t: LText }
export interface Artist {
  id: number; cat: string; color: string; price: number; rating: number; reviews: number;
  verified?: boolean; superhost?: boolean; events?: number; responseTime?: LText; responseRate?: string;
  /** Einsatzradius in km ab dem eigenen Standort; 800 steht für deutschlandweit. */
  radiusKm?: number;
  shopIds?: number[]; name: LText; loc: LText; exp?: LText; desc: LText; tags?: LList; langs?: LList;
  includes?: LList; figures?: any[]; pkgs?: Pkg[]; rev?: Review[]; real?: LText; [k: string]: any;
}
export interface ShopItem {
  id: number; cat: string; artistCat?: string; rent: number; buy: number; rating: number; reviews: number;
  name: LText; desc: LText;
  /** "deko" für Dekoration, fehlt bei Kostümen */
  section?: "deko";
  /** Anlässe: birthday, company, wedding, kids, xmas */
  occ?: string[];
  /** Name des Anbieters, bei Deko */
  vendor?: string;
  /** Eigenes Foto eines Anbieters (IndexedDB) */
  photo?: { id: string; kind: "image" | "video"; name?: string; ratio?: number } | undefined;
  /** Von einem Anbieter in diesem Browser angelegt */
  own?: boolean;
}
export const I18N: Record<string, Record<string, string>>;
export const ICON: Record<string, string>;
export function ic(path: string): string;
export function icf(path: string): string;
export const CATS: { id: string; icon: string }[];
export const ARTISTS: Artist[];
export const SHOP_ITEMS: ShopItem[];
export const SHOP_ADDONS: Record<number, number[]>;
export const SHOP_TABS: { id: string; k: string }[];
export const ART_IMG: Record<string, string>;
export const SHOP_IMG: Record<string, string>;
export function catIcon(id: string): string;

export interface Figure { id: string; de: string; en: string }
export declare const FIGURES: Record<string, Figure[]>;
export declare const PROVIDER_EXTRA: Record<string, { real?: string; figures?: string[] }>;
