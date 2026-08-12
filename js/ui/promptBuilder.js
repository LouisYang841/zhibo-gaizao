/* ========================================
   PromptBuilder - AI 系统提示词构造
   从 promptDefaults.js 读取模板，支持用户自定义覆盖
   ======================================== */

import { getDb } from '../core/dataService.js';
import { pad } from '../core/utils.js';
import { getEffectivePrompt, fillTemplate } from './promptDefaults.js';

// ─── 跨聊天引用工具 ───────────────────

function getPrivateContext(charId, maxMessages = 15) {
  const db = getDb();
  const c = (db.characters || []).find(ch => ch.id === charId);
  if (!c) return { summary: '', recentHistory: '' };
  const parts = [];
  if (c.memorySummary) parts.push(`📝 记忆摘要：${c.memorySummary}`);
  if (c.keyEvents && c.keyEvents.length > 0) parts.push(`⭐ 关键事件：${c.keyEvents.join('；')}`);
  const recent = (c.history || []).slice(-maxMessages);
  if (recent.length > 0) {
    const lines = recent.map(m => {
      const text = (m.content || '').replace(/\[.*?\]/g, '').trim();
      if (!text) return '';
      const role = m.role === 'user' ? '用户' : c.remarkName;
      return `${role}：${text}`;
    }).filter(Boolean);
    if (lines.length > 0) parts.push(`💬 最近私聊记录（${lines.length}条）：\n${lines.join('\n')}`);
  }
  return { summary: parts.join('\n') };
}

function getGroupContext(charId, maxMessages = 10) {
  const db = getDb();
  const groups = (db.groups || []).filter(g =>
    (g.members || []).some(m => m.originalCharId === charId)
  );
  if (groups.length === 0) return '';
  const parts = [];
  groups.forEach(g => {
    const member = g.members.find(m => m.originalCharId === charId);
    const memberName = member ? member.groupNickname : '未知';
    const section = [`【群聊：${g.name}，我在群里的昵称：${memberName}】`];
    if (g.memorySummary) section.push(`📝 群记忆：${g.memorySummary}`);
    const recent = (g.history || []).slice(-maxMessages);
    if (recent.length > 0) {
      const lines = recent.map(m => {
        const text = (m.content || '').replace(/\[.*?\]/g, '').trim();
        if (!text) return '';
        let sender = '用户';
        if (m.senderId && m.senderId !== 'user_me') {
          const senderMember = (g.members || []).find(mem => mem.id === m.senderId);
          sender = senderMember ? (senderMember.groupNickname || senderMember.realName) : '未知成员';
        }
        return `${sender}：${text}`;
      }).filter(Boolean);
      if (lines.length > 0) section.push(`💬 最近群聊记录（${lines.length}条）：\n${lines.join('\n')}`);
    }
    parts.push(section.join('\n'));
  });
  return parts.join('\n\n');
}


// ─── 时间间隔感知 ─────────────────────

function calcTimeGapContext(history) {
  if (!history || history.length < 2) return null;
  const lastMsg = history[history.length - 1];
  const lastTime = lastMsg.timestamp || 0;
  if (!lastTime) return null;
  const now = Date.now();
  const gapMs = now - lastTime;
  if (gapMs < 60 * 1000) return null;
  const gapMinutes = Math.floor(gapMs / (60 * 1000));
  const gapHours = Math.floor(gapMs / (60 * 60 * 1000));
  const gapDays = Math.floor(gapMs / (24 * 60 * 60 * 1000));
  const hour = new Date().getHours();
  const tod = hour < 6 ? '深夜' : hour < 9 ? '清晨' : hour < 12 ? '上午' : hour < 14 ? '中午' : hour < 18 ? '下午' : hour < 21 ? '傍晚' : '晚上';
  let ctx, ins;
  if (gapMinutes < 30) { ctx = `距上次对话仅过去 ${gapMinutes} 分钟`; ins = '保持对话的连续性，如同刚刚交谈过一样自然接续。'; }
  else if (gapHours < 6) { ctx = `距上次对话已过去 ${gapHours} 小时（${tod}）`; ins = '角色注意到时间流逝，可以稍微提及间隔，但整体对话仍保持连贯。'; }
  else if (gapDays < 1) { ctx = `距上次对话已过去 ${gapHours} 小时（现在${tod}）`; ins = '角色意识到间隔了一整天。应该自然地重新问候。'; }
  else if (gapDays < 3) { ctx = `距上次对话已过去 ${gapDays} 天`; ins = '角色感觉到几天未见。先寒暄再进入正题。'; }
  else if (gapDays < 7) { ctx = `距上次对话已过去 ${gapDays} 天`; ins = '角色有"好久不见"的感觉。从重新问候开始。'; }
  else { ctx = `距上次对话已过去 ${gapDays} 天`; ins = '角色感觉相当长时间未交流。询问对方近况。'; }
  return `【时间背景】${ctx}\n【行为要求】${ins}\n`;
}

// ─── 私聊提示词 ───────────────────────

export function generatePrivateSystemPrompt(character) {
  const db = getDb();
  const tpl = (key) => getEffectivePrompt(key, db);
  const wbBefore = (character.worldBookIds || [])
    .map(id => (db.worldBooks || []).find(wb => wb.id === id && wb.position === "before" && wb.enabled !== false))
    .filter(Boolean).map(wb => wb.content).join("\n");
  const wbAfter = (character.worldBookIds || [])
    .map(id => (db.worldBooks || []).find(wb => wb.id === id && wb.position === "after" && wb.enabled !== false))
    .filter(Boolean).map(wb => wb.content).join("\n");
  const builtinBefore = (character.builtinWorldBooks || [])
    .filter(wb => wb.enabled !== false && wb.position !== "after").map(wb => wb.content).join("\n");
  const builtinAfter = (character.builtinWorldBooks || [])
    .filter(wb => wb.enabled !== false && wb.position === "after").map(wb => wb.content).join("\n");
  const myProfile = db.myProfile || {};
  const effectiveMyName = character.myName || myProfile.name || "我";
  const effectiveMyPersona = character.myPersona || myProfile.persona || "";
  const now = new Date();
  const currentTime = now.getFullYear() + "年" + pad(now.getMonth()+1) + "月" + pad(now.getDate()) + "日 " + pad(now.getHours()) + ":" + pad(now.getMinutes());
  const vars = {
    realName: character.realName,
    myName: effectiveMyName,
    status: character.status || "在线",
    persona: character.persona || "无特定人设（由你自行发挥）",
    myPersona: effectiveMyPersona ? "- 对方人设: " + effectiveMyPersona + "\n" : "",
    attitude: character.attitude ? "- 角色对你的态度: " + character.attitude + "\n" : "",
    memorySummary: character.memorySummary ? "- 记忆摘要: " + character.memorySummary + "\n" : "",
    keyEvents: (character.keyEvents?.length) ? "- 关键事件: " + character.keyEvents.join("；") + "\n" : "",
    scenario: character.scenario ? "- 场景: " + character.scenario + "\n" : "",
  };
  let p = "";
  // ① header（固定模板 → 缓存起点）
  p += fillTemplate(tpl("private_header"), vars);
  // ② systemPrompt
  if (character.systemPrompt) {
    p += "【自定义系统指令】\n" + character.systemPrompt + "\n\n";
  }
  // ④ 专属世界书 before+after连续
  if (builtinBefore) p += builtinBefore + "\n";
  if (builtinAfter) p += builtinAfter + "\n";
  // ⑤ 全局世界书 before+after连续
  if (wbBefore) p += wbBefore + "\n";
  if (wbAfter) p += wbAfter + "\n";
  // ⑥ Part 1-5
  p += fillTemplate(tpl("private_part1"), vars);
  p += fillTemplate(tpl("private_part2"), vars);
  p += fillTemplate(tpl("private_part3"), vars);
  p += fillTemplate(tpl("private_part4"), vars);
  p += fillTemplate(tpl("private_part5"), vars);
  // ⑦ 跨聊天引用
  const groupCtx = getGroupContext(character.id, 10);
  if (groupCtx) {
    p += "\n--- ▼ 群聊上下文（可自然提及，勿复述）：\n" + groupCtx;
  }
  // ⑧ currentTime（动态内容放末尾）
  p += "\n【当前时间】\n" + currentTime + "\n\n";
  // ⑧.5 上次消息时间
  const history = (character.history || []);
  if (history.length > 1) {
    const lastMsg = history[history.length - 1];
    if (lastMsg && lastMsg.timestamp) {
      const lastTime = new Date(lastMsg.timestamp).toLocaleString('zh-CN', { hour12: false });
      p += "【上次消息时间】\n" + lastTime + "\n\n";
    }
  }
  // ⑨ 时间感知块
  const timeContext = calcTimeGapContext(history);
  if (timeContext) { p += timeContext + "\n"; }
  return p;
}

// ─── 群聊提示词 ───────────────────────


export function generateGroupSystemPrompt(group) {
  const db = getDb();
  const tpl = (key) => getEffectivePrompt(key, db);
  const wbBefore = (group.worldBookIds || [])
    .map(id => (db.worldBooks || []).find(wb => wb.id === id && wb.position === "before" && wb.enabled !== false))
    .filter(Boolean).map(wb => wb.content).join("\n");
  const wbAfter = (group.worldBookIds || [])
    .map(id => (db.worldBooks || []).find(wb => wb.id === id && wb.position === "after" && wb.enabled !== false))
    .filter(Boolean).map(wb => wb.content).join("\n");
  const builtinBefore = (group.builtinWorldBooks || [])
    .filter(wb => wb.enabled !== false && wb.position !== "after").map(wb => wb.content).join("\n");
  const builtinAfter = (group.builtinWorldBooks || [])
    .filter(wb => wb.enabled !== false && wb.position === "after").map(wb => wb.content).join("\n");
  let membersText = "   - **我 (用户)**: 群内昵称: " + group.me.nickname + "，人设: " + (group.me.persona || "无") + "\n";
  (group.members || []).forEach(m => {
    membersText += "   - **角色: " + m.realName + " (AI)**" + ": 群内昵称: " + m.groupNickname + "，人设: " + (m.persona || "无") + "\n";
    if (m.builtinWorldBooks && m.builtinWorldBooks.length > 0) {
      const mwb = m.builtinWorldBooks.filter(wb => wb.enabled !== false).map(wb => wb.content).join("\n");
      if (mwb) membersText += "     📖 专属设定：\n     " + mwb.replace(/\n/g, "\n     ") + "\n";
    }
    if (m.originalCharId) {
      const privCtx = getPrivateContext(m.originalCharId, 15);
      if (privCtx.summary) membersText += "     📌 私聊上下文：\n     " + privCtx.summary.replace(/\n/g, "\n     ") + "\n";
    }
  });
  const numMembers = (group.members || []).length;
  const vars = { groupName: group.name, meNickname: group.me.nickname, mePersona: group.me.persona || "无", members: membersText, msgMin: numMembers * 2, msgMax: numMembers * 4 };
  let p = "";
  // ① group_header
  p += fillTemplate(tpl("group_header"), vars);
  // ② group_part1
  p += fillTemplate(tpl("group_part1"), vars);
  // ④ 专属世界书
  if (builtinBefore) p += builtinBefore + "\n\n";
  if (builtinAfter) p += builtinAfter + "\n\n";
  // ⑤ 全局世界书
  if (wbBefore) p += wbBefore + "\n\n";
  if (wbAfter) p += wbAfter + "\n\n";
  // ⑥ 记忆+关键事件
  if (group.memorySummary) p += "📝 记忆摘要：" + group.memorySummary + "\n\n";
  if (group.keyEvents && group.keyEvents.length > 0) p += "⭐ 关键事件：" + group.keyEvents.join("；") + "\n\n";
  // ⑦ part2~part3
  p += fillTemplate(tpl("group_part2"), vars);
  p += fillTemplate(tpl("group_part3"), vars);
  // ⑦.5 当前时间 + 上次消息时间
  const now = new Date();
  const currentTime = now.getFullYear() + "年" + pad(now.getMonth()+1) + "月" + pad(now.getDate()) + "日 " + pad(now.getHours()) + ":" + pad(now.getMinutes());
  p += "\n【当前时间】\n" + currentTime + "\n\n";
  const history = (group.history || []);
  if (history.length > 1) {
    const lastMsg = history[history.length - 1];
    if (lastMsg && lastMsg.timestamp) {
      const lastTime = new Date(lastMsg.timestamp).toLocaleString('zh-CN', { hour12: false });
      p += "【上次消息时间】\n" + lastTime + "\n\n";
    }
  }
  // ⑧ 时间感知块
  const timeContext = calcTimeGapContext(history);
  if (timeContext) { p += timeContext + "\n"; }
  return p;
}