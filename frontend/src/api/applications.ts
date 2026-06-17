import api from './index';
import { BorrowApplication, ApiResponse, BorrowApplicationItem } from '../types';

export const applicationsApi = {
  getApplications: (params?: {
    status?: string;
    applicant_id?: string;
    risk_level?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }) => {
    return api.get<any, ApiResponse<BorrowApplication[]>>('/applications', { params });
  },

  getApplication: (id: string) => {
    return api.get<any, ApiResponse<BorrowApplication & { items: BorrowApplicationItem[] }>>(`/applications/${id}`);
  },

  createApplication: (data: {
    work_order_no?: string;
    work_type?: string;
    risk_level?: string;
    purpose?: string;
    expected_return_date?: string;
    remark?: string;
    items: { tool_id: string; apply_quantity: number }[];
  }) => {
    return api.post<any, ApiResponse<{ id: string; application_no: string }>>('/applications', data);
  },

  updateApplication: (id: string, data: any) => {
    return api.put<any, ApiResponse>(`/applications/${id}`, data);
  },

  submitApplication: (id: string) => {
    return api.post<any, ApiResponse>(`/applications/${id}/submit`);
  },

  approveApplication: (id: string, remark?: string) => {
    return api.post<any, ApiResponse>(`/applications/${id}/approve`, { remark });
  },

  rejectApplication: (id: string, remark?: string) => {
    return api.post<any, ApiResponse>(`/applications/${id}/reject`, { remark });
  },

  secondConfirm: (id: string) => {
    return api.post<any, ApiResponse>(`/applications/${id}/second-confirm`);
  },

  deleteApplication: (id: string) => {
    return api.delete<any, ApiResponse>(`/applications/${id}`);
  },

  getPendingIssue: (params?: { page?: number; pageSize?: number }) => {
    return api.get<any, ApiResponse<BorrowApplication[]>>('/issue/pending', { params });
  },

  qualityConfirm: (applicationId: string, itemResults: any[], remark?: string) => {
    return api.post<any, ApiResponse>(`/issue/quality-confirm/${applicationId}`, { itemResults, remark });
  },

  issueTools: (applicationId: string, actualItems: any[], remark?: string) => {
    return api.post<any, ApiResponse<{ issue_id: string }>>(`/issue/issue/${applicationId}`, { actualItems, remark });
  },

  getBorrowed: (params?: { applicant_id?: string; page?: number; pageSize?: number }) => {
    return api.get<any, ApiResponse<BorrowApplication[]>>('/return/borrowed', { params });
  },

  returnTools: (applicationId: string, returnItems: any[], remark?: string) => {
    return api.post<any, ApiResponse<{ return_id: string; has_missing: boolean }>>(`/return/return/${applicationId}`, { returnItems, remark });
  }
};
