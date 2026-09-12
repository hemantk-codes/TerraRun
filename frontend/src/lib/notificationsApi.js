import { api } from './api.js'

export const listNotifications = (before) =>
  api.get(`/notifications${before ? `?before=${encodeURIComponent(before)}` : ''}`)

export const markNotificationRead = (id) => api.post(`/notifications/${id}/read`)

export const markAllNotificationsRead = () => api.post('/notifications/read-all')
