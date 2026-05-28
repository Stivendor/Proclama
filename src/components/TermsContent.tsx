export default function TermsContent() {
  return (
    <div className="terms-content">
      <section className="terms-section">
        <h2>1. Aceptación de los Términos</h2>
        <p>
          Al acceder o utilizar Proclama mediante una cuenta registrada o de administrador,
          aceptas quedar vinculado por estos Términos y Condiciones. Si no estás de acuerdo con
          alguna parte de estos términos, no podrás acceder al servicio.
        </p>
        <p>
          Estos términos se aplican a todos los usuarios de la aplicación, incluyendo usuarios registrados y administradores.
        </p>
      </section>

      <section className="terms-section">
        <h2>2. Descripción del Servicio</h2>
        <p>
          Proclama es una plataforma integral de presentación y gestión para comunidades de fe.
          El servicio se ofrece bajo un modelo **100% gratuito** que desbloquea todas las funciones avanzadas para usuarios registrados, incluyendo:
        </p>
        <ul>
          <li>Acceso completo a la biblioteca integrada de más de 3,000 canciones.</li>
          <li>Búsqueda y proyección de letras online en tiempo real.</li>
          <li>Respaldo y sincronización automática de asistencia en la nube.</li>
          <li>Exportación de reportes detallados en formato PDF y Excel (CSV).</li>
          <li>Importación ilimitada de versiones de la Biblia y personalización con fondos animados (*motion backgrounds*).</li>
        </ul>
      </section>

      <section className="terms-section">
        <h2>3. Límite de Dispositivos y Acceso</h2>
        <p>
          Para garantizar el uso justo del servicio y la seguridad de los servidores, Proclama implementa un límite de dispositivos por cuenta:
        </p>
        <ul>
          <li>Los usuarios pueden tener un máximo de <strong>2 dispositivos</strong> activos de forma simultánea.</li>
          <li>Intentar acceder desde un tercer dispositivo requerirá revocar uno de los dispositivos existentes desde la configuración de la cuenta en la app.</li>
          <li>Queda estrictamente prohibido compartir credenciales de acceso para evadir estos límites. Proclama se reserva el derecho de suspender cuentas que muestren patrones de uso abusivo.</li>
        </ul>
      </section>

      <section className="terms-section">
        <h2>4. Contenido y Moderación</h2>
        <p>
          Nuestra biblioteca comunitaria crece gracias a las aportaciones de los usuarios. Sin embargo:
        </p>
        <ul>
          <li>Toda canción marcada como "Pública" será revisada por nuestro equipo de moderación antes de ser visible para toda la comunidad.</li>
          <li>Nos reservamos el derecho de editar, corregir o eliminar contenido que no cumpla con nuestros estándares de calidad o que infrinja derechos de autor.</li>
          <li>El uso de la Biblia está sujeto a las licencias de sus respectivos traductores; Proclama solo facilita el acceso a versiones de uso libre o bajo convenio.</li>
        </ul>
      </section>

      <section className="terms-section">
        <h2>5. Asistencia y Sincronización</h2>
        <p>
          La función de control de asistencia permite registrar datos de forma local (offline) y sincronizarlos automáticamente con la nube:
        </p>
        <ul>
          <li>La sincronización automática en la nube se realiza de forma totalmente gratuita al iniciar sesión en tu cuenta.</li>
          <li>Proclama no se hace responsable de la pérdida de datos si el usuario limpia la memoria de su navegador antes de que los registros locales se hayan sincronizado correctamente con los servidores de Supabase.</li>
          <li>Los reportes generados son para uso interno de la iglesia y el usuario es el único responsable de la veracidad de los datos ingresados.</li>
        </ul>
      </section>

      <section className="terms-section">
        <h2>6. Carácter Gratuito del Servicio</h2>
        <p>
          Proclama es una herramienta de distribución gratuita para el apoyo ministerial:
        </p>
        <ul>
          <li>No se realizan cargos, suscripciones de pago ni cobros ocultos por el uso de las funciones integradas.</li>
          <li>El equipo de Proclama se reserva el derecho de implementar futuras actualizaciones funcionales libres de costo. Cualquier cambio en los términos del servicio será notificado oportunamente.</li>
        </ul>
      </section>

      <section className="terms-section">
        <h2>7. Privacidad y Seguridad</h2>
        <p>
          Tus datos están protegidos mediante cifrado durante la transmisión. No vendemos ni compartimos tus datos ni los de tu congregación con terceros. Para más detalles, consulta nuestra Política de Privacidad integrada en esta misma plataforma.
        </p>
      </section>

      <section className="terms-section">
        <h2>8. Contacto</h2>
        <p>
          Para soporte técnico o dudas legales, puedes contactarnos a través de la sección de <strong>Sugerencias</strong> en la aplicación o enviando un correo a nuestro equipo de soporte técnico.
        </p>
        <p style={{ marginTop: '20px', fontSize: '12px', color: 'var(--text-muted)' }}>
          Última actualización: 26 de Mayo de 2026
        </p>
      </section>
    </div>
  )
}
