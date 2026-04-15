// Application constants

export const API_ENDPOINTS = {
  BASE_URL:
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.PLANNING_BACKEND_URL ||
    'http://localhost:8081',
  AUTH: {
    SIGNUP: '/auth/signup',
    SIGNIN: '/auth/signin',
    LOGOUT: '/auth/logout',
  },
  AUTH_BY_ROLE: {
    STUDENT: {
      SIGNUP:
        process.env.NEXT_PUBLIC_AUTH_STUDENT_SIGNUP_PATH ||
        process.env.NEXT_PUBLIC_STUDENT_SIGNUP_ENDPOINT ||
        '/students/auth/signup',
      SIGNIN:
        process.env.NEXT_PUBLIC_AUTH_STUDENT_SIGNIN_PATH ||
        process.env.NEXT_PUBLIC_STUDENT_SIGNIN_ENDPOINT ||
        '/students/auth/signin',
    },
    ADMIN: {
      SIGNUP:
        process.env.NEXT_PUBLIC_AUTH_ADMIN_SIGNUP_PATH ||
        process.env.NEXT_PUBLIC_ADMIN_SIGNUP_ENDPOINT ||
        '/admins/auth/signup',
      SIGNIN:
        process.env.NEXT_PUBLIC_AUTH_ADMIN_SIGNIN_PATH ||
        process.env.NEXT_PUBLIC_ADMIN_SIGNIN_ENDPOINT ||
        process.env.NEXT_PUBLIC_STUDENT_SIGNIN_ENDPOINT ||
        '/admins/auth/signin',
    },
  },
};

export const APP_CONFIG = {
  APP_NAME: 'Study Planner',
};
