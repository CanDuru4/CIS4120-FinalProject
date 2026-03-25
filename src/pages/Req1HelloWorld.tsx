export default function Req1HelloWorld({ hideTitle = false }: { hideTitle?: boolean } = {}) {
  return (
    <div>
      {hideTitle ? null : <h2>Requirement 1: Hello world</h2>}
      <p style={{ fontSize: hideTitle ? 20 : undefined, fontWeight: hideTitle ? 900 : undefined }}>Hello World</p>
    </div>
  );
}

