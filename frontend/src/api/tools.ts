import api from './index';
import { Tool, ApiResponse } from '../types';

export const toolsApi = {
  getTools: (params?: {
    keyword?: string;
    status?: string;
    risk_level?: string;
    category?: string;
    calibration_expired?: boolean;
    page?: number;
    pageSize?: number;
  }) => {
    return api.get<any, ApiResponse<Tool[]>>('/tools', { params });
  },

  getTool: (id: string) => {
    return api.get<any, ApiResponse<Tool>>(`/tools/${id}`);
  },

  createTool: (data: Partial<Tool>) => {
    return api.post<any, ApiResponse<{ id: string }>>('/tools', data);
  },

  updateTool: (id: string, data: Partial<Tool>) => {
    return api.put<any, ApiResponse>(`/tools/${id}`, data);
  },

  deleteTool: (id: string) => {
    return api.delete<any, ApiResponse>(`/tools/${id}`);
  },

  getCategories: () => {
    return api.get<any, ApiResponse<string[]>>('/tools/categories/list');
  },

  getCalibrationExpired: () => {
    return api.get<any, ApiResponse<Tool[]>>('/calibration/tools/calibration-expired');
  },

  getCalibrationDue: (days?: number) => {
    return api.get<any, ApiResponse<Tool[]>>('/calibration/tools/calibration-due', { params: { days } });
  }
};
