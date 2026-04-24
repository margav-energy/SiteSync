import axiosInstance from './axiosInstance';

/** Normalised sales invoice row from GET /xero/invoices (Xero ACCREC). */
export type XeroInvoiceListItem = {
  id: string;
  invoice_number: string;
  type: string;
  reference: string | null;
  contact_name: string | null;
  date: string | null;
  due_date: string | null;
  status: string;
  total: number | null;
  amount_due: number | null;
  amount_paid: number | null;
  currency_code: string | null;
};

export type XeroInvoicesResponse = {
  invoices: XeroInvoiceListItem[];
  page: number;
};

export type XeroAccountOption = {
  code: string;
  name: string;
  type: string;
};

export type XeroAccountsResponse = {
  accounts: XeroAccountOption[];
};

export type XeroCreateInvoiceLine = {
  description: string;
  quantity: number;
  unit_amount: number;
  account_code: string;
};

export type XeroCreateInvoicePayload = {
  companyId: string;
  contact_id?: string;
  contact_name?: string;
  date?: string;
  due_date?: string;
  reference?: string;
  /** DRAFT keeps it editable in Xero; AUTHORISED issues it (subject to Xero org rules). */
  status?: 'DRAFT' | 'AUTHORISED' | 'SUBMITTED';
  line_items: XeroCreateInvoiceLine[];
};

export type XeroTenantOption = {
  tenantId: string;
  tenantName: string;
  connectionId: string;
};

export type XeroStatusResponse =
  | {
      status: 'connected';
      company_id: string;
      xero_connected: true;
      xero_tenant_id: string;
      xero_tenant_name?: string | null;
      connected_at?: string;
      connected_by_user_id?: string | null;
      last_refreshed_at?: string | null;
      last_synced_at?: string | null;
    }
  | {
      status: 'disconnected';
      company_id: string;
      xero_connected: false;
    }
  | {
      status: 'reauth_required';
      company_id: string;
      xero_connected: false;
      message?: string;
    }
  | {
      /** Multiple Xero orgs: user must pick one (see getPending + completePending). */
      status: 'pending_tenant';
      company_id: string;
      xero_connected: false;
      pending_id: string;
    };

export const xeroService = {
  async getStatus(companyId: string): Promise<XeroStatusResponse> {
    const { data } = await axiosInstance.get<XeroStatusResponse>('/xero/status', {
      params: { company_id: companyId },
    });
    return data;
  },

  async getConnectStart(companyId: string): Promise<{ authorization_url: string }> {
    const { data } = await axiosInstance.get<{ authorization_url: string }>('/xero/connect/start', {
      params: { company_id: companyId },
    });
    return data;
  },

  async disconnect(companyId: string): Promise<{ ok: boolean; status: string; company_id: string }> {
    const { data } = await axiosInstance.post<{ ok: boolean; status: string; company_id: string }>(
      '/xero/disconnect',
      { company_id: companyId }
    );
    return data;
  },

  async getPending(pendingId: string): Promise<{ pending_id: string; tenants: XeroTenantOption[] }> {
    const { data } = await axiosInstance.get<{ pending_id: string; tenants: XeroTenantOption[] }>(
      `/xero/pending/${pendingId}`
    );
    return data;
  },

  async completePending(pendingId: string, tenantId: string): Promise<{ ok: boolean; status: string; company_id: string }> {
    const { data } = await axiosInstance.post<{ ok: boolean; status: string; company_id: string }>(
      '/xero/pending/complete',
      { pending_id: pendingId, tenant_id: tenantId }
    );
    return data;
  },

  /** Sales invoices (ACCREC) from the linked Xero organisation. */
  async listInvoices(params: {
    companyId: string;
    status?: string;
    page?: number;
  }): Promise<XeroInvoicesResponse> {
    const { data } = await axiosInstance.get<XeroInvoicesResponse>('/xero/invoices', {
      params: {
        company_id: params.companyId,
        status: params.status,
        page: params.page,
      },
    });
    return data;
  },

  /** Revenue-style accounts from the chart (for line item codes). */
  async listAccounts(companyId: string): Promise<XeroAccountsResponse> {
    const { data } = await axiosInstance.get<XeroAccountsResponse>('/xero/accounts', {
      params: { company_id: companyId },
    });
    return data;
  },

  /** Create a sales invoice (ACCREC) in the linked Xero organisation. */
  async createInvoice(payload: XeroCreateInvoicePayload): Promise<{ invoice: XeroInvoiceListItem }> {
    const { data } = await axiosInstance.post<{ invoice: XeroInvoiceListItem }>('/xero/invoices', {
      company_id: payload.companyId,
      contact_id: payload.contact_id,
      contact_name: payload.contact_name,
      date: payload.date,
      due_date: payload.due_date,
      reference: payload.reference,
      status: payload.status,
      line_items: payload.line_items,
    });
    return data;
  },
};
