(() => {
  if (window.__jhdSongCategoryPickerLayout) return;
  window.__jhdSongCategoryPickerLayout = true;

  const style = document.createElement("style");
  style.id = "jhdSongCategoryPickerLayoutStyle";
  style.textContent = `
    #songAdminForm .jhd-song-category-grid{
      grid-template-columns:1fr !important;
      gap:14px;
    }
    #songAdminForm .jhd-song-category-grid > label{min-width:0}
    #songAdminForm .jhd-song-folder-picker{width:100%;box-sizing:border-box}
    #songAdminForm .jhd-scp-summary{
      align-items:flex-start;
      flex-wrap:wrap;
    }
    #songAdminForm .jhd-scp-summary>div{
      min-width:0;
      flex:1 1 190px;
    }
    #songAdminForm .jhd-scp-summary .song-btn{
      flex:0 0 auto;
      margin-left:auto;
    }
    #songAdminForm .jhd-scp-summary strong{
      max-width:none;
      white-space:normal;
      overflow:visible;
      text-overflow:clip;
      line-height:1.35;
    }
    #songAdminForm .jhd-scp-panel{box-sizing:border-box;width:100%}
    #songAdminForm .jhd-scp-types button{min-height:48px}
    #songAdminForm .jhd-scp-tools{align-items:stretch}
    #songAdminForm .jhd-scp-tools input{width:100%;box-sizing:border-box}
    @media(max-width:620px){
      #songAdminForm .jhd-scp-summary .song-btn{width:100%;margin-left:0}
      #songAdminForm .jhd-scp-tools .song-btn{width:100%}
    }
  `;
  if (!document.getElementById(style.id)) document.head.append(style);

  function arrange() {
    document.querySelectorAll("#songAdminForm .jhd-song-folder-picker").forEach((picker) => {
      const label = picker.closest("label");
      const grid = label?.parentElement;
      if (grid?.classList.contains("admin-form-grid")) grid.classList.add("jhd-song-category-grid");
    });
  }

  const workspace = document.getElementById("adminWorkspace");
  if (workspace) new MutationObserver(arrange).observe(workspace, { childList: true, subtree: true });
  arrange();
})();
