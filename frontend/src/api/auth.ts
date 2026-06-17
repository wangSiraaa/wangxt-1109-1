import api from './index';
import { User, ApiResponse } from '../types';

export const authApi = {
  login: (username: string, password: string) => {
    return api.post<any, ApiResponse<{ token: string; user: User }>>('/auth/login', { username, password });
  },
  
  getProfile: () => {
    return api.get<any, ApiResponse<User>>('/auth/profile');
  },
  
  getUsers: (role?: string) => {
    return api.get<any, ApiResponse<User[]>>('/auth/users', { params: { role } });
  }
};
