export default function Loading() {
  return (
    <main className="universal-loader" aria-live="polite" aria-busy="true">
      <div className="loader-brand" aria-hidden="true">T</div>
      <div className="loader-copy">
        <strong>Tracing the record</strong>
        <span>Retrieving source passages</span>
      </div>
      <div className="retrieval-loader" aria-hidden="true">
        <div className="loader-source-lines">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="loader-trace">
          <span />
          <span />
          <span />
        </div>
        <div className="loader-citation">
          <b>01</b>
          <i />
          <i />
        </div>
      </div>
    </main>
  );
}
