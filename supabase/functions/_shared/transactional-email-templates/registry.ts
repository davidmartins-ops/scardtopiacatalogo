/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as orderStatusUpdate } from './order-status-update.tsx'
import { template as orderReceived } from './order-received.tsx'
import { template as pixReceiptReceived } from './pix-receipt-received.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'order-status-update': orderStatusUpdate,
  'order-received': orderReceived,
  'pix-receipt-received': pixReceiptReceived,
}
