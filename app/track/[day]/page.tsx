'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId, useSendTransaction, useSwitchChain, useWaitForTransactionReceipt } from 'wagmi';
import { base } from 'wagmi/chains';
import { isAddress, parseEther } from 'viem';
import { AlbumArt } from '../../components/AlbumArt';
import { MintButton } from '../../components/MintButton';
import {
  COMMENT_FEE_ETH,
  COMMENT_RECEIVER,
  DAILY_MUSE_CONTRACT_ADDRESS,
  MAIN_APP_URL,
  MINT_PRICE_ETH,
} from '../../constants';
import {
  buildReleasesFromManifest,
  type ContentOverrideMap,
  type Release,
  type ReleaseManifestItem,
} from '../../lib/release-data';

type LocalComment = {
  id: string;
  day: number;
  author: string;
  message: string;
  txHash: `0x${string}`;
  amountEth: string;
  createdAt: string;
};

const COMMENT_STORAGE_KEY = 'th3scr1b3_paid_comments_v1';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function toErrorMessage(error: unknown) {
  if (!error) return 'Request failed.';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const shortMessage = (error as { shortMessage?: unknown }).shortMessage;
    if (typeof shortMessage === 'string' && shortMessage.length > 0) return shortMessage;
  }
  return 'Request failed.';
}

function shortenAddress(address?: string) {
  if (!address) return '';
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function readStoredComments() {
  if (typeof window === 'undefined') return [] as LocalComment[];
  try {
    const raw = window.localStorage.getItem(COMMENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalComment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredComments(comments: LocalComment[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(COMMENT_STORAGE_KEY, JSON.stringify(comments));
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (!isFinite(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export default function TrackDetailsPage() {
  const params = useParams<{ day: string }>();
  const day = Number(params.day);

  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<LocalComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [pendingComment, setPendingComment] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const { sendTransactionAsync, isPending: isSendingCommentTx } = useSendTransaction();

  const {
    isLoading: isConfirmingComment,
    isSuccess: isCommentPaid,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    chainId: base.id,
    hash: txHash,
  });

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const manifestRes = await fetch('/release-manifest.json');
        if (!manifestRes.ok) throw new Error('Failed to load release manifest.');
        const manifestData = (await manifestRes.json()) as { items?: ReleaseManifestItem[] };

        let overrides: ContentOverrideMap = {};
        try {
          const overridesRes = await fetch('/content-overrides.json');
          if (overridesRes.ok) {
            overrides = (await overridesRes.json()) as ContentOverrideMap;
          }
        } catch (error) {
          console.warn('[TrackDetails] content-overrides load failed', error);
        }

        const built = buildReleasesFromManifest(manifestData.items || [], overrides);
        if (isMounted) setReleases(built);
      } catch (error) {
        console.warn('[TrackDetails] release load failed', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!Number.isFinite(day) || day <= 0) return;
    const stored = readStoredComments().filter((entry) => entry.day === day);
    setComments(stored.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)));
  }, [day]);

  useEffect(() => {
    if (!receiptError) return;
    setCommentError(toErrorMessage(receiptError));
  }, [receiptError]);

  useEffect(() => {
    if (!isCommentPaid || !pendingComment || !txHash || !Number.isFinite(day) || day <= 0) return;

    const entry: LocalComment = {
      id: `${txHash}-${Date.now()}`,
      day,
      author: address || 'unknown',
      message: pendingComment,
      txHash,
      amountEth: COMMENT_FEE_ETH,
      createdAt: new Date().toISOString(),
    };

    const updated = [entry, ...readStoredComments()].slice(0, 300);
    writeStoredComments(updated);
    setComments(updated.filter((item) => item.day === day));
    setPendingComment(null);
    setTxHash(undefined);
    setCommentError(null);
  }, [address, day, isCommentPaid, pendingComment, txHash]);

  const release = useMemo(
    () => releases.find((item) => item.day === day),
    [releases, day]
  );

  const hasCommentReceiver =
    isAddress(COMMENT_RECEIVER) && COMMENT_RECEIVER !== ZERO_ADDRESS;
  const isCommentBusy = isSwitchingChain || isSendingCommentTx || isConfirmingComment;
  const commentCount = comments.length;

  const submitComment = async () => {
    if (isCommentBusy) return;
    setCommentError(null);

    try {
      if (!release) throw new Error('Track not loaded yet.');
      if (!hasCommentReceiver) {
        throw new Error('Set NEXT_PUBLIC_COMMENT_RECEIVER to enable paid comments.');
      }
      if (!isConnected) throw new Error('Connect wallet to comment.');

      const message = commentText.trim();
      if (!message) throw new Error('Enter a comment.');
      if (message.length > 280) throw new Error('Comment must be 280 characters or less.');

      if (chainId !== base.id) {
        await switchChainAsync({ chainId: base.id });
      }

      const hash = await sendTransactionAsync({
        to: COMMENT_RECEIVER as `0x${string}`,
        value: parseEther(COMMENT_FEE_ETH),
      });

      setPendingComment(message);
      setCommentText('');
      setTxHash(hash);
    } catch (error) {
      setCommentError(toErrorMessage(error));
    }
  };

  if (!Number.isFinite(day) || day <= 0) {
    return (
      <main className="track-page">
        <div className="container track-page-inner">
          <Link href="/" className="track-back-link">← Back to releases</Link>
          <section className="support-card">
            <div className="support-card-title">Track Not Found</div>
            <p className="support-card-copy">Invalid track day in URL.</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="track-page">
      <div className="container track-page-inner">
        <Link href="/" className="track-back-link">← Back to releases</Link>

        {loading && (
          <section className="support-card">
            <div className="support-card-title">Loading</div>
            <p className="support-card-copy">Loading track details...</p>
          </section>
        )}

        {!loading && !release && (
          <section className="support-card">
            <div className="support-card-title">Not Available</div>
            <p className="support-card-copy">
              Day {day} is not available yet. Go back to the release grid for available drops.
            </p>
          </section>
        )}

        {release && (
          <>
            <section className="track-hero support-card animate-in">
              <div className="track-hero-art">
                <AlbumArt day={release.day} mood={release.mood} artworkUrl={release.artworkUrl} />
              </div>
              <div className="track-hero-copy">
                <div className="track-hero-top">
                  <span className={`tag mood-${release.mood || 'dark'}`}>{release.mood || 'dark'}</span>
                  {release.durationFormatted && <span className="tag duration">{release.durationFormatted}</span>}
                </div>
                <h1>Day {release.day}: {release.title}</h1>
                <p>{release.description}</p>
                {release.storedAudioUrl && (
                  <audio className="track-audio" controls preload="none" src={release.storedAudioUrl} />
                )}
              </div>
            </section>

            <div className="track-details-grid">
              <section className="support-card animate-in">
                <div className="support-card-title">Mint Details</div>
                <div className="track-info-list">
                  <div><span>Token ID</span><strong>{release.day}</strong></div>
                  <div><span>Mint Price</span><strong>{MINT_PRICE_ETH} ETH</strong></div>
                  <div><span>Contract</span><strong>{shortenAddress(DAILY_MUSE_CONTRACT_ADDRESS)}</strong></div>
                  <div><span>Main App</span><strong><a href={MAIN_APP_URL} target="_blank" rel="noreferrer">Open</a></strong></div>
                </div>
                <div className="track-actions-row">
                  <MintButton day={release.day} />
                  <a
                    className="track-link-btn"
                    href={`https://basescan.org/address/${DAILY_MUSE_CONTRACT_ADDRESS}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Contract ↗
                  </a>
                </div>
              </section>

              <section className="support-card animate-in">
                <div className="support-card-title">Paid Comments</div>
                <p className="support-card-copy">
                  Post a comment by paying {COMMENT_FEE_ETH} ETH on Base. The transaction hash is attached to each comment.
                </p>

                <div className="track-info-list">
                  <div><span>Comment Fee</span><strong>{COMMENT_FEE_ETH} ETH</strong></div>
                  <div><span>Receiver</span><strong>{shortenAddress(COMMENT_RECEIVER)}</strong></div>
                  <div><span>Comments</span><strong>{commentCount}</strong></div>
                </div>

                <div className="comment-compose">
                  <textarea
                    className="comment-input"
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    maxLength={280}
                    placeholder="Write your comment (max 280 chars)"
                  />
                  <button
                    type="button"
                    className="comment-submit-btn"
                    onClick={() => {
                      void submitComment();
                    }}
                    disabled={!hasCommentReceiver || !isConnected || isCommentBusy}
                  >
                    {isCommentBusy ? 'Processing...' : `Post (${COMMENT_FEE_ETH} ETH)`}
                  </button>
                </div>

                <div className={`support-card-helper ${commentError ? 'wallet-status-error' : ''}`}>
                  {commentError || (
                    hasCommentReceiver
                      ? (isConnected ? 'Wallet connected. Comment posts after transaction confirmation.' : 'Connect wallet to post comments.')
                      : 'Set NEXT_PUBLIC_COMMENT_RECEIVER to enable comments.'
                  )}
                </div>

                <div className="comment-list">
                  {commentCount === 0 && (
                    <div className="comment-empty">No comments yet for this day.</div>
                  )}
                  {comments.map((comment) => (
                    <article key={comment.id} className="comment-item">
                      <div className="comment-item-top">
                        <span>{shortenAddress(comment.author)}</span>
                        <span>{formatDate(comment.createdAt)}</span>
                      </div>
                      <p>{comment.message}</p>
                      <a
                        href={`https://basescan.org/tx/${comment.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Tx: {shortenAddress(comment.txHash)}
                      </a>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            {release.customInfo && (
              <section className="support-card track-info-html animate-in">
                <div className="support-card-title">Track Notes</div>
                <div dangerouslySetInnerHTML={{ __html: release.customInfo }} />
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
