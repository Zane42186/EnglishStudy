'use strict';

const studentRepository = require('../repositories/student.repository');
const ApiError = require('../utils/ApiError');
const { env } = require('../config/env');

/**
 * 解析请求对应的学生。第一阶段为单用户：
 * 未显式传 studentId 时，使用 .env 的 DEFAULT_STUDENT_NAME。
 */
async function resolveStudentId({ studentId, studentName } = {}) {
  if (studentId) {
    const student = await studentRepository.findById(studentId);
    if (!student) {
      throw ApiError.notFound('STUDENT_NOT_FOUND', `学生不存在：id=${studentId}`);
    }
    return student.id;
  }

  const name = studentName || env.defaultStudentName;
  const student = await studentRepository.findByName(name);
  if (!student) {
    throw new ApiError(
      'STUDENT_NOT_FOUND',
      404,
      `默认学生「${name}」不存在，请先执行 npm run db:init 初始化数据`
    );
  }
  return student.id;
}

function mapStudent(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname,
    email: row.email,
    target: row.target,
    status: row.status,
    createdAt: row.created_at,
  };
}

async function getStudent(studentId) {
  const row = await studentRepository.findById(studentId);
  if (!row) throw ApiError.notFound('STUDENT_NOT_FOUND', `学生不存在：id=${studentId}`);
  return mapStudent(row);
}

module.exports = { resolveStudentId, getStudent, mapStudent };
