import api from './index';
import { InvestigationReport, ApiResponse, CalibrationRecord } from '../types';

export const investigationApi = {
  getReports: (params?: {
    status?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }) => {
    return api.get<any, ApiResponse<InvestigationReport[]>>('/investigation', { params });
  },

  getReport: (id: string) => {
    return api.get<any, ApiResponse<InvestigationReport>>(`/investigation/${id}`);
  },

  updateReport: (id: string, data: Partial<InvestigationReport>) => {
    return api.put<any, ApiResponse>(`/investigation/${id}`, data);
  },

  closeReport: (id: string, investigation_result?: string, handle_remark?: string) => {
    return api.post<any, ApiResponse>(`/investigation/${id}/close`, { investigation_result, handle_remark });
  },

  submitInvestigation: (id: string, investigation_result: string, handle_remark?: string) => {
    return api.post<any, ApiResponse>(`/investigation/${id}/submit-investigation`, { investigation_result, handle_remark });
  },

  qualityReview: (id: string, passed: boolean, review_remark?: string) => {
    return api.post<any, ApiResponse>(`/investigation/${id}/quality-review`, { passed, review_remark });
  }
};

export const calibrationApi = {
  getRecords: (params?: {
    tool_id?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }) => {
    return api.get<any, ApiResponse<CalibrationRecord[]>>('/calibration', { params });
  },

  createRecord: (data: Partial<CalibrationRecord>) => {
    return api.post<any, ApiResponse<{ id: string }>>('/calibration', data);
  }
};

export const statsApi = {
  getDashboard: () => {
    return api.get<any, ApiResponse<any>>('/stats/dashboard');
  }
};
