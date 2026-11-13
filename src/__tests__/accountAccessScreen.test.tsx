import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import AccountAccessStatus from '@/components/auth/AccountAccessStatus';
describe('startup loading and recovery',()=>{
 it('keeps a native reload fallback in initial HTML before JavaScript is ready',()=>{
  const html=renderToStaticMarkup(createElement(AccountAccessStatus));
  expect(html).toContain('role="status"');expect(html).toContain('연결 중');
  expect(html).toContain('action="/"');expect(html).toContain('method="get"');
  expect(html).not.toContain('주비를 준비하고 있어요');expect(html).not.toContain('로그인과 계정 정보를');
 });
 it('exposes the failure reason and retry without requiring a disclosure',()=>{
  const html=renderToStaticMarkup(createElement(AccountAccessStatus,{error:true,message:'연결 확인 필요',onRetry:()=>{},onSwitchAccount:()=>{}}));
  expect(html).toContain('role="alert"');expect(html).toContain('연결 확인 필요');expect(html).toContain('다시 연결하기');
  expect(html).toContain('다른 계정으로 로그인');expect(html).not.toContain('<details');expect(html).not.toContain('role="status"');
 });
 it('identifies account checks without presenting a server failure as a user connection problem',()=>{
  const pending=renderToStaticMarkup(createElement(AccountAccessStatus,{phase:'consent'}));
  expect(pending).toContain('이용 동의 내역을 확인하고 있어요.');
  expect(pending).toContain('data-mood="privacy"');
  const failed=renderToStaticMarkup(createElement(AccountAccessStatus,{phase:'session',error:true,onRetry:()=>{}}));
  expect(failed).toContain('지금 계정을 확인할 수 없어요');
  expect(failed).toContain('data-mood="retry"');
  expect(failed).toContain('서버 응답을 받지 못했어요');
  expect(failed).toContain('다시 연결하기');
 });
});
