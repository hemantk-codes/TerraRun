/**
 * Phase 9 REST calls, routed through the existing `api` client (lib/api.js)
 * so they inherit the same auth-header attachment, 401 -> refresh -> retry,
 * and error handling every other authenticated call in this app already
 * has — no separate token plumbing needed here.
 *
 * ⚠️ INTEGRATION ASSUMPTION: assumes `api` exposes `.get(path, options)`
 * alongside the `.post` / `.patch` already used in AuthContext.jsx, and
 * that it resolves with the parsed JSON body directly (matching how
 * AuthContext reads `data.user` / `data.accessToken` straight off it). If
 * your api.js names the GET method differently, this is the one file to
 * adjust.
 */
import { api } from './api.js'

export const searchUsers = (q) => api.get(`/friends/search?q=${encodeURIComponent(q)}`)

export const getFriendStatus = (userId) => api.get(`/friends/status/${userId}`)

export const followUser = (userId) => api.post(`/friends/follow/${userId}`)

export const unfollowUser = (userId) => api.post(`/friends/unfollow/${userId}`)

export const listFriends = () => api.get('/friends')

export const listConversations = () => api.get('/messages/conversations')

export const getThread = (otherUserId, before) =>
  api.get(`/messages/thread/${otherUserId}${before ? `?before=${encodeURIComponent(before)}` : ''}`)
