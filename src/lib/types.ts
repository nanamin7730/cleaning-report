export type Database = {
  public: {
    Tables: {
      properties: {
        Row: {
          id: string
          name: string
          address: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          address?: string
          updated_at?: string
        }
        Relationships: []
      }
      inspection_items: {
        Row: {
          id: string
          property_id: string
          name: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          property_id: string
          name: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      cleaning_reports: {
        Row: {
          id: string
          property_id: string
          cleaned_at: string
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          property_id: string
          cleaned_at: string
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          cleaned_at?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      report_items: {
        Row: {
          id: string
          report_id: string
          inspection_item_id: string | null
          item_name: string
          before_photo_url: string | null
          after_photo_url: string | null
          item_notes: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          report_id: string
          inspection_item_id?: string | null
          item_name: string
          before_photo_url?: string | null
          after_photo_url?: string | null
          item_notes?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          item_name?: string
          before_photo_url?: string | null
          after_photo_url?: string | null
          item_notes?: string | null
          sort_order?: number
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Property = Database['public']['Tables']['properties']['Row']
export type InspectionItem = Database['public']['Tables']['inspection_items']['Row']
export type CleaningReport = Database['public']['Tables']['cleaning_reports']['Row']
export type ReportItem = Database['public']['Tables']['report_items']['Row']

export type ReportWithProperty = CleaningReport & {
  properties: Property
  report_items: ReportItem[]
}
