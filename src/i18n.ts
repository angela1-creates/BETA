import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

export const supportedLanguages = ['en', 'zh-CN'] as const
export type AppLanguage = typeof supportedLanguages[number]

const resources = {
  en: { translation: {
    nav: { find: 'Find Crew', climbs: 'My Climbs', share: 'Share', crew: 'My Crew', home: 'BETA home', profile: 'Open profile' },
    common: { cancel: 'Cancel', discard: 'Discard', preview: 'Preview', confirm: 'Confirm', close: 'Close', private: 'Private', optional: 'optional', back: 'Back', demo: 'Demo mode', live: 'Connected' },
    demo: { title: 'Interactive demo', detail: 'People and matching requests are fictional. Nothing is sent to a real gym or climber.' },
    home: { kicker: 'Climb · capture · share · connect', titleStart: 'Climbing is better', titleEnd: 'together.', subtitle: 'Find your crew, share your beta, and make every climb memorable.', share: 'Share a climb', crew: 'Climb with my crew', need: 'Need someone to climb with?', find: 'Find a partner →', solo: 'Solo climbs welcome', privacy: 'Private by default', adults: '18+ partner matching' },
    find: { kicker: 'Optional partner discovery', title: 'Need someone to climb with?', subtitle: 'Find an adult climbing buddy headed to the same gym, without exposing phone numbers or live location.', create: 'Create availability', safetyTitle: 'Adult matching only', safety: 'Experience and belay qualifications are self-reported. Always complete gym checks and normal partner safety checks.', formTitle: 'When do you want to climb?', fast: 'Under 30 seconds', gym: 'Gym', day: 'Day', time: 'Start time', climbing: 'Climbing', looking: 'Looking for', experience: 'Experience', message: 'Short message', consent: 'I confirm I’m 18 or older and will follow gym safety checks.', publish: 'Publish demo request', invite: 'Invite to climb', pending: 'Invitation pending', accept: 'Simulate acceptance', decline: 'Decline', cancelled: 'Request cancelled', confirmed: 'Session confirmed. Meet in the lobby and complete normal safety checks.', validation: 'Confirm that you are 18 or older before publishing.' },
    climbs: { kicker: 'My Climbs', title: 'Keep the moments, not the metrics.', subtitle: 'Solo boulder, family day, or a session with friends. Upload first. Organize nothing.', quick: 'Quick path', save: 'Save a climbing moment', description: 'A photo or short video and one sentence. No partner, crew, or annotation required.', caption: 'Caption', captionPlaceholder: 'Six tries, one breakthrough.', choose: 'Choose photo or video', draft: 'Preview your moment', confirm: 'Save private moment', saved: 'Moment saved privately on this device', privateHelp: 'Private by default. Demo media stays on this device.', deep: 'Deep path · Original BETA', lesson: 'What did the wall teach you?', routeLab: 'Open Route Lab', memories: 'Climbs worth remembering', discard: 'Discard draft' },
    share: { kicker: 'Share the Beta', title: 'Every body finds a different way.', subtitle: 'Turn a climbing day into something your group chat actually wants to open.', newChallenge: 'Set up a challenge', myClimb: 'My Climb', different: 'Different Beta', challenge: 'Beta Challenge', terms: 'Share on your terms.', privateHelp: 'Media starts private. A link works only after you explicitly turn it on.', createLink: 'Create shareable link', revoke: 'Revoke link', shareAction: 'Share via messages or apps', download: 'Download card', builderTitle: 'Preview your beta challenge', challengeTitle: 'Challenge title', prompt: 'Question for your crew', audience: 'Who can view?', reveal: 'Reveal responses manually', confirmChallenge: 'Create private challenge', challengeSaved: 'Challenge created privately', discardChallenge: 'Discard challenge draft', response: 'Your beta', lock: 'Lock in my response', revealResponses: 'Reveal responses', hideResponses: 'Hide responses', createPrivateLink: 'Create private share link →' },
    crew: { kicker: 'My Crew', title: 'The people who make you want to come back.', subtitle: 'Plan with people you already know, invite them by link, and save shared memories with consent.', new: 'Create private crew', return: 'Come back together', calendar: 'You have a climbing day on the calendar.', ready: 'Ready for the next climbing day?', favorites: 'Climb together again', plan: 'Plan another session', groups: 'Your crews', invite: 'Invite a friend', inviteTitle: 'Invite someone you already know', invitee: 'Friend’s name', copyInvite: 'Create invitation link', rsvp: 'RSVP preview', accept: 'Accept', decline: 'Decline', sessionTitle: 'Plan the next climbing day', propose: 'Send session proposal', recap: 'View private recap →', privacyTitle: 'You control who gets close.' },
    status: { backendUnavailable: 'Demo mode · backend not connected', backendReady: 'Supabase connected', linkCreated: 'Demo link created. Anyone with it can view permitted content.', linkRevoked: 'Link revoked', copied: 'Invitation link copied', duplicate: 'That action is already pending.' },
    language: { label: 'Language', english: 'English', chinese: '中文' }
  } },
  'zh-CN': { translation: {
    nav: { find: '找搭档', climbs: '我的攀爬', share: '分享', crew: '我的伙伴', home: 'BETA 首页', profile: '打开个人资料' },
    common: { cancel: '取消', discard: '舍弃', preview: '预览', confirm: '确认', close: '关闭', private: '私密', optional: '可选', back: '返回', demo: '演示模式', live: '已连接' },
    demo: { title: '互动演示', detail: '人物和匹配请求均为虚构，不会发送给真实岩馆或攀岩者。' },
    home: { kicker: '攀爬 · 记录 · 分享 · 连接', titleStart: '一起攀岩', titleEnd: '更精彩。', subtitle: '找到伙伴，分享攀法，让每次攀岩都值得记住。', share: '分享一次攀爬', crew: '和我的伙伴攀岩', need: '临时需要搭档？', find: '寻找攀岩搭档 →', solo: '欢迎独自抱石', privacy: '默认私密', adults: '搭档匹配仅限 18 岁以上' },
    find: { kicker: '可选的搭档发现', title: '需要攀岩搭档吗？', subtitle: '寻找前往同一岩馆的成年攀岩伙伴，不公开电话号码或实时位置。', create: '发布可约时间', safetyTitle: '仅限成年人匹配', safety: '经验和保护资质均为本人陈述。请务必完成岩馆要求的检查，并和搭档进行常规安全互检。', formTitle: '你想什么时候攀岩？', fast: '30 秒内完成', gym: '岩馆', day: '日期', time: '开始时间', climbing: '攀岩方式', looking: '寻找', experience: '经验', message: '简短留言', consent: '我确认已满 18 岁，并会遵守岩馆安全检查要求。', publish: '发布演示请求', invite: '邀请一起攀岩', pending: '邀请待回复', accept: '模拟接受', decline: '拒绝', cancelled: '请求已取消', confirmed: '攀岩安排已确认。请在前台会合并完成常规安全检查。', validation: '发布前请确认你已满 18 岁。' },
    climbs: { kicker: '我的攀爬', title: '记住精彩，不只记录数字。', subtitle: '独自抱石、家庭日或好友局，都可以直接上传，无需先组织行程。', quick: '快捷路径', save: '保存攀岩时刻', description: '一张照片或一段短视频，再加一句话。不需要搭档、小队或线路标注。', caption: '文字说明', captionPlaceholder: '尝试六次，终于突破。', choose: '选择照片或视频', draft: '预览你的攀岩时刻', confirm: '私密保存', saved: '攀岩时刻已私密保存在此设备', privateHelp: '默认私密。演示媒体只保存在此设备。', deep: '深度路径 · 原版 BETA', lesson: '这面墙教会了你什么？', routeLab: '打开线路实验室', memories: '值得记住的攀爬', discard: '舍弃草稿' },
    share: { kicker: '分享攀法', title: '每个人都有自己的解法。', subtitle: '把一次攀岩变成群聊里大家都想点开的内容。', newChallenge: '设置挑战', myClimb: '我的攀爬', different: '不同攀法', challenge: '攀法挑战', terms: '按你的方式分享。', privateHelp: '媒体默认私密。只有你主动开启链接后，别人才能访问。', createLink: '创建分享链接', revoke: '撤销链接', shareAction: '通过信息或应用分享', download: '下载卡片', builderTitle: '预览攀法挑战', challengeTitle: '挑战标题', prompt: '问伙伴的问题', audience: '谁可以查看？', reveal: '由我手动公开回答', confirmChallenge: '创建私密挑战', challengeSaved: '挑战已私密创建', discardChallenge: '舍弃挑战草稿', response: '你的攀法', lock: '锁定我的回答', revealResponses: '公开回答', hideResponses: '隐藏回答', createPrivateLink: '创建私密分享链接 →' },
    crew: { kicker: '我的伙伴', title: '因为这些人，你会想再次回来。', subtitle: '和认识的朋友或家人安排攀岩，在所有人同意后保存共同回忆。', new: '创建私密小队', return: '再次一起攀岩', calendar: '你已经安排了一次攀岩。', ready: '准备好下一次攀岩了吗？', favorites: '再次一起攀岩', plan: '安排下一次', groups: '我的小队', invite: '邀请朋友', inviteTitle: '邀请你已经认识的人', invitee: '朋友姓名', copyInvite: '创建邀请链接', rsvp: '回复预览', accept: '接受', decline: '拒绝', sessionTitle: '安排下一次攀岩', propose: '发送活动提议', recap: '查看私密回顾 →', privacyTitle: '由你决定谁可以靠近。' },
    status: { backendUnavailable: '演示模式 · 后端未连接', backendReady: 'Supabase 已连接', linkCreated: '演示链接已创建。持有链接的人可以查看获准内容。', linkRevoked: '链接已撤销', copied: '邀请链接已复制', duplicate: '该操作正在等待处理。' },
    language: { label: '语言', english: 'English', chinese: '中文' }
  } }
} as const

const stored = typeof localStorage === 'undefined' ? null : localStorage.getItem('beta-language')
const detected = typeof navigator === 'undefined' ? 'en' : navigator.language
const initialLanguage: AppLanguage = stored === 'zh-CN' || (!stored && detected.toLowerCase().startsWith('zh')) ? 'zh-CN' : 'en'

void i18n.use(initReactI18next).init({ resources, lng: initialLanguage, fallbackLng: 'en', interpolation: { escapeValue: false } })
i18n.on('languageChanged', language => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('beta-language', language)
  if (typeof document !== 'undefined') document.documentElement.lang = language
})
if (typeof document !== 'undefined') document.documentElement.lang = initialLanguage

export default i18n
