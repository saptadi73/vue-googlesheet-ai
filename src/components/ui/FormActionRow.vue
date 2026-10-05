<template>
  <div class="form-action-container">
    <div class="form-action-row">
      <div class="form-action-fields"><slot /></div>
      <div class="form-action-buttons"><slot name="actions" /></div>
    </div>
  </div>
</template>

<style scoped>
.form-action-container {
  container-type: inline-size;
  margin: 16px 0 20px;
}
.form-action-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 16px;
}
.form-action-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: 16px;
  min-width: 0;
}
.form-action-fields :deep(label) {
  min-width: 0;
  margin: 0;
}
.form-action-fields :deep(input),
.form-action-fields :deep(select) {
  height: 42px;
}
.form-action-buttons {
  display: flex;
  gap: 10px;
}
.form-action-buttons :deep(button),
.form-action-buttons :deep(a.button) {
  min-height: 42px;
  white-space: nowrap;
}
@container (max-width: 720px) {
  .form-action-row,
  .form-action-fields {
    grid-template-columns: minmax(0, 1fr);
  }
  .form-action-buttons {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
