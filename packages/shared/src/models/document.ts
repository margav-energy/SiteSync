export type DocumentType = 'cscs' | 'health_safety' | 'insurance' | 'cpp' | 'rams';

export interface Document {
  id: string;
  user_id: string;
  type: DocumentType;
  name: string;
  url: string;
  expiry_date?: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
}
