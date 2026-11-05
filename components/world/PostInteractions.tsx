import {translateUI, useLocale} from '../../i18n/react';
import React, { useEffect, useState } from 'react';
import { getTweetReplies, getPostTradeBuyers, type ApiReply, type WorldEvent } from '../../api/client';
import { plainContent } from '../../world/model';

export default function PostInteractions({event}: {event: WorldEvent}) {
  useLocale();
  const postId = event.kind === 'post' ? event.tweetId : undefined;
  const sourceId = event.curationSourceId || postId;
  const token = event.communityToken || event.token;
  const [comments, setComments] = useState<ApiReply[] | 'error' | null>(null);
  const [buyers, setBuyers] = useState<Awaited<ReturnType<typeof getPostTradeBuyers>> | 'error' | null>(null);

  useEffect(() => {
    let active = true;
    if (postId) getTweetReplies(postId).then(rows => active && setComments(rows), () => active && setComments('error'));
    if (sourceId && token) getPostTradeBuyers(token, sourceId).then(rows => active && setBuyers(rows), () => active && setBuyers('error'));
    return () => { active = false; };
  }, [postId, sourceId, token]);

  return <>
    {postId && <section className="inspector-section"><h3>{translateUI("评论")}</h3>
      {translateUI(comments === 'error' ? '评论暂不可用' : !comments ? '正在加载评论…' : !comments.length ? '暂无已收录评论' :
        comments.map(row => <p key={row.replyId}><strong>{row.twitterName || row.twitterUsername || row.twitterId}</strong><br/>{plainContent(row.content)}</p>))}
    </section>}
    {(postId || sourceId) && <section className="inspector-section"><h3>{translateUI("社交交易")}</h3>
      {translateUI(!token || buyers === 'error' ? '交易数据暂不可用' : !buyers ? '正在加载交易…' : !buyers.length ? '暂无已确认买入记录' :
        buyers.map(row => <p key={row.twitterId}><strong>{row.twitterName || row.twitterId}</strong><br/>{translateUI("买入 ")}{translateUI(row.buyCount)}{translateUI(" 次，共 ")}{translateUI(row.tokenAmount)} {event.tick}</p>))}
    </section>}
  </>;
}
