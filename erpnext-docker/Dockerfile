# Custom ERPNext image with my_white_label theme app.
# Uses official Frappe/ERPNext image and adds the app at build time.
ARG ERPNEXT_VERSION=v16
FROM frappe/erpnext:${ERPNEXT_VERSION}

USER root

# Copy custom theme app into image
COPY my_white_label /tmp/my_white_label
RUN chown -R frappe:frappe /tmp/my_white_label

USER frappe
WORKDIR /home/frappe/frappe-bench

# Add custom app into bench (copy + pip install)
RUN cp -r /tmp/my_white_label apps/my_white_label && \
    bench pip install -e apps/my_white_label

# Custom entrypoint: wait for DB/Redis, create site, install my_white_label, then start
COPY entrypoint.sh /entrypoint.sh
USER root
RUN chmod +x /entrypoint.sh
USER frappe

ENTRYPOINT ["/entrypoint.sh"]
CMD ["bench", "start"]
