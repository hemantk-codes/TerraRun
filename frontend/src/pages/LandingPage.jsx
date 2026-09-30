import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:5000/api'

function formatStatNumber(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return '—'
  }

  if (number >= 1000000) {
    return `${(number / 1000000).toFixed(1)}M`
  }

  if (number >= 1000) {
    return `${(number / 1000).toFixed(1)}K`
  }

  return Math.round(number).toLocaleString('en-IN')
}

export default function LandingPage() {
  const [stats, setStats] = useState({
    totalUsers: null,
    totalTerritories: null,
    totalCalories: null,
  })

  useEffect(() => {
    let cancelled = false

    async function loadStats() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/leaderboard?limit=1`,
        )

        if (!response.ok) {
          throw new Error('Failed to load landing stats')
        }

        const data = await response.json()

        if (!cancelled) {
          setStats({
            totalUsers:
              Number(data?.stats?.totalUsers) || 0,

            totalTerritories:
              Number(data?.stats?.totalTerritories) || 0,

            totalCalories:
              Number(data?.stats?.totalCalories) || 0,
          })
        }
      } catch {
        if (!cancelled) {
          setStats({
            totalUsers: 0,
            totalTerritories: 0,
            totalCalories: 0,
          })
        }
      }
    }

    loadStats()

    const intervalId = window.setInterval(
      loadStats,
      30000,
    )

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  return (
    <main className="tr-landing">
      <style>{`
        .tr-landing {
          --ink: #162331;
          --lime: #c9ff2f;
          --pink: #ff4fa3;
          --cyan: #50ddff;
          --paper: #fff8ea;

          position: relative;
          min-height: 100vh;
          overflow: hidden;
          isolation: isolate;
          color: var(--ink);
          background: var(--paper);
          font-family: Arial, Helvetica, sans-serif;
        }

        .tr-landing::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: -2;
          background-image: url('/landing-page.png');
          background-position: center center;
          background-repeat: no-repeat;
          background-size: 100% 100%;
        }

        .tr-landing-hero {
          width: min(1200px, calc(100% - 64px));
          min-height: 100vh;
          margin: 0 auto;
          display: flex;
          align-items: flex-start;
          padding: 120px 0 44px;
        }

        .tr-landing-copy {
          width: min(760px, 58vw);
          margin-left: 0;
          position: relative;
          z-index: 2;
        }

        .tr-landing-kicker {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-height: 34px;
          padding: 0 15px;
          border: 2px solid var(--ink);
          border-radius: 999px;
          background: rgba(17, 29, 41, .96);
          color: #fff;
          box-shadow: 0 5px 0 rgba(17, 29, 41, .16);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .085em;
          line-height: 1;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .tr-landing-kicker-dot {
          width: 9px;
          height: 9px;
          flex: none;
          border-radius: 50%;
          border: 2px solid #fff;
          background: var(--lime);
          box-shadow: 0 0 10px rgba(201, 255, 47, .65);
        }

        .tr-landing-kicker strong {
          color: var(--lime);
          font-weight: 900;
        }

        .tr-landing-title {
          margin: 24px 0 18px;
          font-family: 'Arial Black', Arial, Helvetica, sans-serif;
          font-weight: 900;
          font-size: clamp(74px, 8.05vw, 126px);
          line-height: .92;
          letter-spacing: -.075em;
          text-transform: uppercase;
          transform: scaleX(.96);
          transform-origin: left center;
        }

        .tr-landing-title span {
          display: block;
          width: max-content;
          position: relative;
        }

        .tr-landing-run {
          color: var(--ink);
          text-shadow:
            0 0 3px rgba(255,255,255,.98),
            0 0 5px rgba(255,255,255,1),
            0 0 13px rgba(255,255,255,.95),
            0 0 24px rgba(255,255,255,.72),
            0 3px 0 rgba(22,35,49,.18);
        }

        .tr-landing-claim {
          color: var(--pink);
          text-shadow:
            0 0 3px rgba(255,255,255,.98),
            0 0 5px rgba(255,255,255,1),
            0 0 13px rgba(255,255,255,.95),
            0 0 24px rgba(255,255,255,.72),
            2px 3px 0 rgba(22,35,49,.18);
        }

        .tr-landing-dominate {
          color: var(--ink);
          text-shadow:
            0 0 3px rgba(255,255,255,.98),
            0 0 5px var(--cyan),
            0 0 13px rgba(80,221,255,.95),
            0 0 24px rgba(80,221,255,.72),
            0 3px 0 rgba(22,35,49,.18);
        }

        .tr-landing-title .dominate-shadow {
          position: absolute;
          left: 0;
          top: 0;
          z-index: -1;
          color: transparent;
          -webkit-text-stroke: 4px var(--cyan);
          filter: blur(2px);
          opacity: .9;
          pointer-events: none;
        }

        .tr-landing-run::after,
        .tr-landing-claim::after {
          content: attr(data-text);
          position: absolute;
          inset: 0;
          z-index: -1;
          color: transparent;
          -webkit-text-stroke: 4px #ffffff;
          filter: blur(2px);
          opacity: .9;
          pointer-events: none;
        }

        .tr-landing-description {
          max-width: 610px;
          margin: 0;
          color: #344555;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.58;
          letter-spacing: -.005em;
          text-wrap: balance;
        }

        .tr-landing-actions {
          margin-top: 24px;
        }

        .tr-landing-start {
          min-width: 210px;
          height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 11px;
          padding: 0 24px;

          border: none;
          border-radius: 999px;

          background: #c9ff2f;

          color: #111111;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: .01em;
          line-height: 1;
          text-decoration: none;
          text-transform: uppercase;

          box-shadow:
            0 4px 0 #88ad18,
            0 7px 12px rgba(45, 65, 12, .20);

          transition:
            transform .15s ease,
            box-shadow .15s ease;
        }

        .tr-landing-start:hover {
          transform: translateY(-1px);

          box-shadow:
            0 5px 0 #88ad18,
            0 9px 15px rgba(45, 65, 12, .22);
        }

        .tr-landing-start:active {
          transform: translateY(3px);

          box-shadow:
            0 1px 0 #88ad18,
            0 3px 7px rgba(45, 65, 12, .16);
        }

        .tr-landing-arrow {
          font-size: 18px;
          font-weight: 900;
          line-height: 1;
          transform: translateY(-1px);
        }

        .tr-landing-map-label {
          position: absolute;
          z-index: 20;
          min-width: 100px;
          height: 40px;
          padding: 0 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid var(--ink);
          border-radius: 11px;
          background: rgba(8, 18, 28, 0.98);
          color: #ffffff !important;
          opacity: 1 !important;
          box-shadow:
            4px 4px 0 rgba(8, 18, 28, 0.78),
            0 0 12px rgba(255,255,255,0.08);
          font-family: Arial, Helvetica, sans-serif;
          font-size: 13px;
          font-weight: 900;
          line-height: 1;
          letter-spacing: 0.02em;
          white-space: nowrap;
          text-shadow: 0 1px 2px rgba(0,0,0,.8);
        }

        .tr-landing-map-label span {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #ffffff !important;
          opacity: 1 !important;
        }

        .tr-landing-map-label i {
          display: block;
          width: 10px;
          height: 10px;
          flex: 0 0 10px;
          border-radius: 50%;
        }

        .tr-landing-map-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--lime);
          box-shadow: 0 0 9px rgba(201,255,47,.60);
        }

        .tr-landing-map-label--you {
          left: 48%;
          top: 29%;
        }

        .tr-landing-map-label--alex {
          left: 85%;
          top: 29%;
        }

        .tr-landing-map-label--priya {
          left: 91%;
          top: 61%;
        }

        .tr-landing-map-label--riko {
          left: 61%;
          top: 50%;
        }

        .tr-landing-map-label--alex .tr-landing-map-dot {
          background: var(--pink);
          box-shadow: 0 0 9px rgba(255,79,163,.60);
        }

        .tr-landing-map-label--priya .tr-landing-map-dot {
          background: #ffad38;
          box-shadow: 0 0 9px rgba(255,173,56,.58);
        }

        .tr-landing-map-label--riko .tr-landing-map-dot {
          background: #52d7ff;
          box-shadow: 0 0 9px rgba(82,215,255,.58);
        }

        .tr-landing-live-card {
          position: absolute;
          right: 2.5%;
          bottom: 32px;
          z-index: 21;
          width: min(440px, 41vw);
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          padding: 18px 14px;
          border: 1px solid rgba(22,35,49,.10);
          border-radius: 22px;
          background: rgba(255,255,255,.93);
          box-shadow: 0 16px 34px rgba(22,35,49,.18);
          backdrop-filter: blur(10px);
        }

        .tr-landing-stat {
          position: relative;
          text-align: center;
        }

        .tr-landing-stat + .tr-landing-stat::before {
          content: '';
          position: absolute;
          left: 0;
          top: 8px;
          bottom: 8px;
          width: 1px;
          background: rgba(22,35,49,.10);
        }

        .tr-landing-stat strong {
          display: block;
          font-size: 30px;
          font-weight: 900;
          line-height: .95;
          letter-spacing: -.055em;
        }

        .tr-landing-stat small {
          display: block;
          margin-top: 5px;
          color: #7a8590;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .09em;
          text-transform: uppercase;
        }

        @media (max-width: 1050px) {
          .tr-landing-hero {
            width: min(920px, calc(100% - 36px));
            padding-top: 120px;
          }

          .tr-landing-copy {
            width: min(680px, 64vw);
            margin-left: 0;
          }

          .tr-landing-title {
            font-size: clamp(66px, 8.8vw, 102px);
          }

          .tr-landing-live-card {
            width: min(400px, 46vw);
          }
        }

        @media (max-width: 780px) {
          .tr-landing-hero {
            width: calc(100% - 28px);
            min-height: 100vh;
            align-items: flex-start;
            padding-top: 120px;
          }

          .tr-landing-copy {
            width: 100%;
            margin: 0;
          }

          .tr-landing-title {
            font-size: clamp(60px, 17vw, 94px);
          }

          .tr-landing-description {
            max-width: 500px;
            font-size: 13px;
          }

          .tr-landing-start {
            min-width: 210px;
          }

          .tr-landing-live-card {
            display: none;
          }

          .tr-landing-map-label {
            display: flex;
          }
        }
      `}</style>

      <section className="tr-landing-hero">
        <div className="tr-landing-copy">

          <div className="tr-landing-kicker">
            FITNESS IS NOW A <strong>TERRITORY WAR</strong>
          </div>

          <h1
            className="tr-landing-title"
            aria-label="Run. Claim. Dominate."
          >
            <span
              className="tr-landing-run"
              data-text="RUN."
            >
              RUN.
            </span>

            <span
              className="tr-landing-claim"
              data-text="CLAIM."
            >
              CLAIM.
            </span>

            <span className="tr-landing-dominate">
              <span
                className="dominate-shadow"
                aria-hidden="true"
              >
                DOMINATE.
              </span>

              DOMINATE.
            </span>
          </h1>

          <p className="tr-landing-description">
            Turn your runs and walks into real-world territory.
            Every route can become land. Every rival can become a target.
          </p>

          <div className="tr-landing-actions">
            <Link
              to="/run"
              className="tr-landing-start"
            >
              START A RUN

              <span className="tr-landing-arrow">
                →
              </span>
            </Link>
          </div>

        </div>
      </section>

      {/* RINKO */}
      <div className="tr-landing-map-label tr-landing-map-label--riko">
        <span>
          <i className="tr-landing-map-dot" />
          Rinko
        </span>
      </div>

      {/* YOU */}
      <div className="tr-landing-map-label tr-landing-map-label--you">
        <span>
          <i className="tr-landing-map-dot" />
          You
        </span>
      </div>

      {/* ALEX */}
      <div className="tr-landing-map-label tr-landing-map-label--alex">
        <span>
          <i className="tr-landing-map-dot" />
          Alex
        </span>
      </div>

      {/* PRIYA */}
      <div className="tr-landing-map-label tr-landing-map-label--priya">
        <span>
          <i className="tr-landing-map-dot" />
          Priya
        </span>
      </div>

      {/* LIVE STATS */}
      <div className="tr-landing-live-card">

        <div className="tr-landing-stat">
          <strong style={{ color: '#49bc77' }}>
            {stats.totalUsers === null
              ? '—'
              : formatStatNumber(stats.totalUsers)}
          </strong>

          <small>
            Users
          </small>
        </div>

        <div className="tr-landing-stat">
          <strong style={{ color: '#ff65ae' }}>
            {stats.totalTerritories === null
              ? '—'
              : formatStatNumber(stats.totalTerritories)}
          </strong>

          <small>
            Territories
          </small>
        </div>

        <div className="tr-landing-stat">
          <strong style={{ color: '#ff9d3d' }}>
            {stats.totalCalories === null
              ? '—'
              : formatStatNumber(stats.totalCalories)}
          </strong>

          <small>
            Total Calories
          </small>
        </div>

      </div>
    </main>
  )
}