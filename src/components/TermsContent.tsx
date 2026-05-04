export default function TermsContent() {
  return (
    <div className="terms-content">
      <section className="terms-section">
        <h2>1. Aceptación de los Términos</h2>
        <p>
          Al acceder o utilizar Proclama, ya sea mediante una cuenta registrada, suscripción Premium o en modo invitado,
          aceptas quedar vinculado por estos Términos y Condiciones. Si no estás de acuerdo con
          alguna parte de estos términos, no podrás acceder al servicio.
        </p>
        <p>
          Estos términos se aplican a todos los usuarios de la aplicación, incluyendo visitantes,
          usuarios registrados, suscriptores Premium y administradores.
        </p>
      </section>

      <section className="terms-section">
        <h2>2. Descripción del Servicio y Planes</h2>
        <p>
          Proclama es una plataforma integral de presentación y gestión para comunidades de fe.
          Ofrecemos diferentes niveles de servicio:
        </p>
        <ul>
          <li><strong>Plan Gratuito:</strong> Incluye biblioteca local, proyección básica y gestión de setlists. El acceso está limitado a un solo dispositivo y la sincronización en la nube es limitada.</li>
          <li><strong>Plan Premium:</strong> Desbloquea la sincronización avanzada entre múltiples dispositivos, reportes detallados de asistencia (PDF/CSV), gestión de avisos en la nube y personalización extendida.</li>
        </ul>
      </section>

      <section className="terms-section">
        <h2>3. Límite de Dispositivos y Acceso</h2>
        <p>
          Para garantizar la seguridad y el uso justo del servicio, Proclama implementa límites de dispositivos:
        </p>
        <ul>
          <li>Los usuarios con <strong>Plan Premium</strong> pueden tener un máximo de <strong>2 dispositivos</strong> activos de forma simultánea.</li>
          <li>Intentar acceder desde un tercer dispositivo bloqueará el acceso hasta que se revoque uno de los dispositivos existentes desde la configuración de la cuenta.</li>
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
          La función de control de asistencia permite registrar datos de forma local (offline) y sincronizarlos con la nube:
        </p>
        <ul>
          <li>La sincronización automática es una función exclusiva de usuarios Premium y Administradores.</li>
          <li>Proclama no se hace responsable de la pérdida de datos si el usuario limpia la memoria de su navegador antes de que los registros locales se hayan sincronizado correctamente con Supabase.</li>
          <li>Los reportes generados son para uso interno de la iglesia y el usuario es el único responsable de la veracidad de los datos ingresados.</li>
        </ul>
      </section>

      <section className="terms-section">
        <h2>6. Pagos y Cancelaciones</h2>
        <p>
          Las suscripciones Premium se procesan a través de proveedores de pago seguros.
        </p>
        <ul>
          <li>Los pagos son finales y no reembolsables, a menos que la ley local dicte lo contrario.</li>
          <li>Puedes cancelar tu suscripción en cualquier momento; seguirás teniendo acceso a las funciones Premium hasta el final del ciclo de facturación actual.</li>
          <li>Al finalizar una suscripción Premium, tu cuenta volverá al Plan Gratuito y es posible que pierdas acceso a funciones como la sincronización multi-dispositivo.</li>
        </ul>
      </section>

      <section className="terms-section">
        <h2>7. Privacidad y Seguridad</h2>
        <p>
          Tus datos están protegidos mediante cifrado de extremo a extremo durante la transmisión. No vendemos tus datos a terceros. Para más detalles, consulta nuestra Política de Privacidad integrada en esta misma plataforma.
        </p>
      </section>

      <section className="terms-section">
        <h2>8. Contacto</h2>
        <p>
          Para soporte técnico o dudas legales, puedes contactarnos a través de la sección de <strong>Sugerencias</strong> o enviando un correo a nuestro equipo de soporte técnico.
        </p>
        <p style={{ marginTop: '20px', fontSize: '12px', color: 'var(--text-muted)' }}>
          Última actualización: 1 de Junio de 2026
        </p>
      </section>
    </div>
  )
}
