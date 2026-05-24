// src/lib/schemas.ts
import { z } from "zod";

export const CreateReservationSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  warehouseId: z.string().min(1, "Warehouse ID is required"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

export const ReservationStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "RELEASED",
]);

export type ReservationStatus = z.infer<typeof ReservationStatusSchema>;

// API response shapes
export interface ProductWithStock {
  id: string;
  name: string;
  description: string | null;
  sku: string;
  price: number;
  imageUrl: string | null;
  stockLevels: {
    warehouseId: string;
    warehouseName: string;
    warehouseLocation: string;
    totalUnits: number;
    reserved: number;
    available: number;
  }[];
}

export interface WarehouseInfo {
  id: string;
  name: string;
  location: string;
}

export interface ReservationDetail {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productPrice: number;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: string; // ISO string
  createdAt: string;
}

export interface ApiError {
  error: string;
  code?: string;
}
