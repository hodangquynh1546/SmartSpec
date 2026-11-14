import logger from "../../lib/logger";
// socket.ts
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Project from '../../internal/model/project';
import User from '../../internal/model/user';
import Session from '../../internal/model/session';
import { Server as HttpServer } from 'http';
import { usecaseSocketService } from '../command-ingress/features/usecase/domain/usecase.socket.service';
import { inputSocketService } from '../command-ingress/features/input/domain/input.socket.service';
import { presenceSocketService } from '../command-ingress/features/presence/domain/presence.socket.service';
import { versionSocketService } from '../command-ingress/features/version/domain/version.socket.service';
import { logSocketService } from '../command-ingress/features/log/domain/log.socket.service';
export let io: Server;

export function initSocket(server: HttpServer) {
    io = new Server(server, {
        cors: { origin: '*', methods: ['GET', 'POST'] }
    });

    // Track projects for each socket for auto cleanup
    const socketProjects = new Map<string, Set<string>>();

    // Danh tính của socket do SERVER xác định từ JWT (trước đây tin userId do client tự khai → ai cũng vào được phòng của mọi dự án).
    // Chấp nhận token đã hết hạn nếu phiên (sid) còn sống: kết nối lại sau khi idle không nên mất realtime.
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (token) {
                const claims: any = jwt.verify(String(token), process.env.JWT_SECRET || 'default', { ignoreExpiration: true });
                const alive = claims?.sid ? await Session.exists({ sessionID: claims.sid, userID: claims._id }) : null;
                const user: any = alive ? await User.findById(claims._id).select('status').lean() : null;
                if (user && user.status !== 'INACTIVE') { socket.data.userId = String(claims._id); socket.data.role = claims.system_role; }
            }
        } catch { /* không có danh tính: vẫn kết nối được nhưng không vào được phòng nào */ }
        next();
    });

    io.on('connection', (socket) => {
        //logger.info(`✅ User connected: ${socket.id}, userId: ${socket.handshake.auth.userId}`);
        socket.on('join_system_logs', () => {
            if (socket.data.role !== 'ADMIN') return; // nhật ký toàn hệ thống: chỉ quản trị viên
            //logger.info(`🧩 User ${socket.id} joined global system log room`);
            logSocketService.joinSystemRoom(socket);
        });
        // Initialize projects set for this socket
        socketProjects.set(socket.id, new Set<string>());

        // Join notification room (existing)
        socket.on('notification', () => {
            if (socket.data.userId) socket.join(`user_${socket.data.userId}`); // chỉ phòng của chính mình
        });

        // ✅ Join project room for realtime collaboration
        socket.on('join_project', async (projectId: string) => {
            const userId = socket.data.userId;
            if (!userId || !mongoose.isValidObjectId(projectId)) return;
            const member = await Project.exists({
                _id: projectId,
                $or: [{ owner_id: userId }, { members: { $elemMatch: { user_id: userId, status: 'accepted' } } }],
            });
            if (!member) { socket.emit('join_denied', { projectId }); return; } // không phải thành viên: không nhận sự kiện nào

            //logger.info(`🎯 User ${userId} joining project ${projectId}`);

            // Track this project for the socket
            socketProjects.get(socket.id)?.add(projectId);

            // Join usecase & input rooms (existing)
            usecaseSocketService.joinProjectRoom(socket, projectId);
            inputSocketService.joinProjectRoom(socket, projectId);
            logSocketService.joinProjectRoom(socket, projectId);
            // ✅ Join presence tracking
            try {
                const userInfo = await getUserInfo(userId);
                //logger.info(`👤 Retrieved user info for ${userId}:`, userInfo?.name);
                await presenceSocketService.joinProjectRoom(socket, projectId, userId, userInfo);
            } catch (error) {
                //logger.error('Error joining presence room:', error);
                // Fallback với basic info
                const fallbackUserInfo = {
                    name: 'Unknown User',
                    email: '',
                    avatar_url: ''
                };
                await presenceSocketService.joinProjectRoom(socket, projectId, userId, fallbackUserInfo);
            }
            versionSocketService.joinProjectRoom(socket, projectId);

        });

        // ✅ Leave project room
        socket.on('leave_project', async (projectId: string) => {
            const userId = socket.data.userId;
            //logger.info(`🚪 User ${userId} leaving project ${projectId}`);

            // Remove from tracking
            socketProjects.get(socket.id)?.delete(projectId);

            usecaseSocketService.leaveProjectRoom(socket, projectId);
            inputSocketService.leaveProjectRoom(socket, projectId);
            await presenceSocketService.leaveProjectRoom(socket, projectId);
            versionSocketService.leaveProjectRoom(socket, projectId);
            logSocketService.leaveProjectRoom(socket, projectId);
        });

        socket.on('disconnect', async (reason) => {
            //logger.info(`❌ User disconnected: ${socket.id}, reason: ${reason}`);

            // ✅ Auto cleanup on disconnect - Leave all projects
            const userProjects = socketProjects.get(socket.id);
            if (userProjects && userProjects.size > 0) {
                //logger.info(`🧹 Cleaning up ${userProjects.size} projects for disconnected user`);
                // Convert Set to Array để tương thích với TypeScript config
                const projectIds = Array.from(userProjects);
                for (const projectId of projectIds) {
                    // Chỉ cleanup nếu socket thực sự có trong project
                    // leaveProjectRoom sẽ tự xử lý nếu socket không có trong Redis
                    await presenceSocketService.leaveProjectRoom(socket, projectId);
                    usecaseSocketService.leaveProjectRoom(socket, projectId);
                    inputSocketService.leaveProjectRoom(socket, projectId);
                }
                socketProjects.delete(socket.id);
            }
            // Nếu không có userProjects, socket có thể đã được cleanup trước đó hoặc chưa join project nào
            // Đây là trường hợp bình thường, không cần log
        });

        // Error handling
        socket.on('error', (error) => {
            logger.error(`❌ Socket error for ${socket.id}:`, error);
        });
    });

    return io;
}

// Helper function to get user info
async function getUserInfo(userId: string) {
    try {
        const User = await import('../../internal/model/user').then(m => m.default);
        const user = await User.findById(userId).select('name email avatar_url');

        if (!user) {
            //logger.warn(`⚠️ User not found: ${userId}`);
            return null;
        }

        return user;
    } catch (error) {
        logger.error(`❌ Error fetching user ${userId}:`, error);
        throw error;
    }
}