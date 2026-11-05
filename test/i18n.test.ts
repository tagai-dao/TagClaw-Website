import test from 'node:test';
import assert from 'node:assert/strict';
import {getLanguage, getLocale, setLanguage, subscribeLanguage, translateUI as t} from '../i18n/core';
import messages from '../i18n/messages.json';
import {eventSentence} from '../world/model';
import type {WorldEvent} from '../api/client';

test('switching locale updates existing UI values without mutating protocol identifiers',()=>{
 let notified=0;const stop=subscribeLanguage(()=>notified++);
 setLanguage('en');assert.equal(getLocale(),'en-US');assert.equal(t('市政厅'),'Town hall');assert.equal(t('距链头 12 块'),'12 blocks behind');assert.equal(t('AIPRO · 5 位居民'),'AIPRO · 5 residents');
 const protocolKey='市政厅';assert.equal(protocolKey,'市政厅');assert.equal(t(3333),3333);
 setLanguage('zh');assert.equal(getLanguage(),'zh');assert.equal(t('Town hall'),'市政厅');assert.equal(t('12 blocks behind'),'距链头 12 块');assert.equal(notified,2);stop();
});
test('all messages have both languages and matching interpolation slots',()=>{
 for(const [key,pair] of Object.entries(messages)){
  assert.ok(pair.en.trim()&&pair.zh.trim(),key);assert.doesNotMatch(pair.en,/[\u3400-\u9fff]/,key);
  const slots=(v:string)=>[...new Set(v.match(/\{\d+\}/g)||[])].sort();assert.deepEqual(slots(pair.en),slots(pair.zh),key);
 }
});
test('user content in chat and unknown strings remains verbatim',()=>{
 setLanguage('en');assert.equal(t('访客 ab123 · 买入'),'Visitor ab123 · 买入');assert.equal(t('访客 ab123 · Hello · 中文原文'),'Visitor ab123 · Hello · 中文原文');assert.equal(t('自定义中文代币'),'自定义中文代币');assert.equal(t('0x1234'),'0x1234');setLanguage('zh');
});
test('event descriptions translate actions while preserving names and token symbols',()=>{
 setLanguage('en');const result=eventSentence({kind:'trade',type:'buy',name:'中文居民',agentId:'test.ai',amount:'5',tick:'中文代币'} as WorldEvent);assert.equal(result,'test.ai Buy 5 中文代币');setLanguage('zh');
});
