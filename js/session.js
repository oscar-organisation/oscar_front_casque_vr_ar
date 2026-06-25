(function () {
  const AUTH_KEY = 'oscar-authenticated';
  const USER_KEY = 'oscar-auth-user';

  function isAuthenticated() {
    return sessionStorage.getItem(AUTH_KEY) === '1';
  }

  function setAuthenticated(email = '') {
    sessionStorage.setItem(AUTH_KEY, '1');
    if (email) {
      sessionStorage.setItem(USER_KEY, email);
    }
  }

  function clearAuthenticated() {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem('oscar-tutorial-done');
  }

  function protectPage() {
    const body = document.body;
    const shouldProtect = body?.dataset?.protect === 'true';

    if (!shouldProtect) return;

    if (!isAuthenticated()) {
      clearAuthenticated();
      window.location.replace('connexion.html');
    }
  }

  function bindLogoutLinks() {
    document.querySelectorAll('[data-action="logout"], .js-logout').forEach((element) => {
      element.addEventListener('click', (event) => {
        event.preventDefault();
        clearAuthenticated();
        window.location.href = 'connexion.html';
      });
    });

    document.querySelectorAll('a[href="connexion.html"], a[href="./connexion.html"], a[href="../pages/connexion.html"]').forEach((link) => {
      link.addEventListener('click', (event) => {
        if (link.dataset.keepSession === 'true') return;
        event.preventDefault();
        clearAuthenticated();
        window.location.href = link.getAttribute('href');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindLogoutLinks();
    protectPage();
  });

  window.addEventListener('pageshow', () => {
    protectPage();
  });

  window.OSCARSession = {
    isAuthenticated,
    setAuthenticated,
    clearAuthenticated,
    protectPage,
    bindLogoutLinks,
  };
})();
