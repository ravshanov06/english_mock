(function () {
  function getModal(modalOrId) {
    if (!modalOrId) return null;
    if (typeof modalOrId === 'string') return document.getElementById(modalOrId);
    return modalOrId;
  }

  function withQuery(href, key, value) {
    var base = String(href || '');
    var hashIndex = base.indexOf('#');
    var hash = hashIndex === -1 ? '' : base.slice(hashIndex);
    var path = hashIndex === -1 ? base : base.slice(0, hashIndex);
    return path + (path.indexOf('?') === -1 ? '?' : '&') + encodeURIComponent(key) + '=' + encodeURIComponent(value) + hash;
  }

  function create(modalOrId) {
    var modal = getModal(modalOrId);
    if (!modal) return null;
    if (modal.__attemptModalController) return modal.__attemptModalController;

    var pendingHandler = null;

    function close(action) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      if (pendingHandler && (action === 'redo' || action === 'review')) {
        var handler = pendingHandler;
        pendingHandler = null;
        handler(action);
        return;
      }
      pendingHandler = null;
    }

    function open(onResolve) {
      pendingHandler = onResolve;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');

      var primaryButton = modal.querySelector('[data-attempt-action="review"]');
      var closeButton = modal.querySelector('[data-attempt-dismiss]');
      window.setTimeout(function () {
        (primaryButton || closeButton || modal).focus();
      }, 0);
    }

    modal.addEventListener('click', function (event) {
      if (event.target === modal) close();
    });

    var dismissButton = modal.querySelector('[data-attempt-dismiss]');
    if (dismissButton) {
      dismissButton.addEventListener('click', function () {
        close();
      });
    }

    Array.prototype.forEach.call(modal.querySelectorAll('[data-attempt-action]'), function (button) {
      button.addEventListener('click', function () {
        close(button.getAttribute('data-attempt-action'));
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && modal.classList.contains('is-open')) {
        close();
      }
    });

    modal.__attemptModalController = {
      open: open,
      close: close
    };
    return modal.__attemptModalController;
  }

  window.IELTSAttemptModal = {
    create: create,
    withQuery: withQuery
  };
})();
