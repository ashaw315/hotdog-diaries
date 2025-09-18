export default function EmergencyAdminPage() {
  return (
    <div>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.location.href = '/emergency-login.html';
          `,
        }}
      />
      <div style={{
        textAlign: 'center',
        padding: '50px',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🌭</div>
        <h1>Redirecting to Emergency Login...</h1>
        <p>If you&apos;re not redirected, <a href="/emergency-login.html">click here</a></p>
      </div>
    </div>
  );
}