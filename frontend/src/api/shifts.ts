import api from './index';
import { Shift, ShiftHandover, OperationLog, ApiResponse } from '../types';

export const shiftsApi = {
  getCurrentShift: () => {
    return api.get<any, ApiResponse<Shift>>('/shifts/current');
  },

  getShifts: (params?: {
    status?: string;
    page?: number;
    pageSize?: number;
  }) => {
    return api.get<any, ApiResponse<Shift[]>>('/shifts', { params });
  },

  getShift: (id: string) => {
    return api.get<any, ApiResponse<Shift>>(`/shifts/${id}`);
  },

  createShift: (data: {
    shift_name: string;
    shift_type: string;
    start_time: string;
    end_time: string;
    leader_id?: string;
  }) => {
    return api.post<any, ApiResponse<{ id: string }>>('/shifts', data);
  },

  endShift: (id: string) => {
    return api.post<any, ApiResponse>(`/shifts/${id}/end`);
  },

  createHandover: (data: {
    from_shift_id: string;
    to_shift_id: string;
    to_user_id: string;
    to_user_name: string;
    remark?: string;
  }) => {
    return api.post<any, ApiResponse<{ id: string }>>('/shifts/handover', data);
  },

  getPendingHandovers: () => {
    return api.get<any, ApiResponse<ShiftHandover[]>>('/shifts/handover/pending');
  },

  getHandover: (id: string) => {
    return api.get<any, ApiResponse<ShiftHandover>>(`/shifts/handover/${id}`);
  },

  getHandovers: (params?: {
    status?: string;
    page?: number;
    pageSize?: number;
  }) => {
    return api.get<any, ApiResponse<ShiftHandover[]>>('/shifts/handover', { params });
  },

  confirmHandover: (id: string, remark?: string) => {
    return api.post<any, ApiResponse>(`/shifts/handover/${id}/confirm`, { remark });
  },

  rejectHandover: (id: string, remark: string) => {
    return api.post<any, ApiResponse>(`/shifts/handover/${id}/reject`, { remark });
  },

  getOperationLogs: (params?: {
    operation_type?: string;
    business_id?: string;
    shift_id?: string;
    page?: number;
    pageSize?: number;
  }) => {
    return api.get<any, ApiResponse<OperationLog[]>>('/shifts/logs', { params });
  }
};
