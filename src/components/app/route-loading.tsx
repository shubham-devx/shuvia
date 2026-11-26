type RouteLoadingProps = { label: string; privatePage?: boolean }

export function RouteLoading({ label, privatePage = true }: RouteLoadingProps) {
  return (
    <main className={privatePage ? 'route-loading route-loading-private' : 'route-loading route-loading-public'} aria-busy="true" aria-label={label}>
      {privatePage ? (
        <>
          <aside className="route-loading-side" aria-hidden="true">
            <i className="loading-mark" />
            <i className="loading-line loading-line-short" />
            {Array.from({ length: 6 }, (_, index) => <i className="loading-nav-row" key={index} />)}
          </aside>
          <section className="route-loading-main" aria-hidden="true">
            <div className="loading-topbar"><i /><i /></div>
            <div className="loading-content">
              <i className="loading-line loading-line-short" />
              <i className="loading-title" />
              <i className="loading-line loading-line-medium" />
              <div className="loading-panels"><i /><i /></div>
            </div>
          </section>
        </>
      ) : (
        <section className="route-loading-public-card" aria-hidden="true">
          <i className="loading-mark" />
          <i className="loading-title" />
          <i className="loading-line loading-line-medium" />
          <i className="loading-field" />
          <i className="loading-field" />
          <i className="loading-action" />
        </section>
      )}
      <span className="sr-only">{label}</span>
    </main>
  )
}
