"use client";

import { useId, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Check, Plus } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const specimenSchema = z.strictObject({
  label: z
    .string()
    .trim()
    .min(2, "Enter at least 2 characters.")
    .max(40, "Use 40 characters or fewer."),
});

/** A form integration specimen, deliberately restricted to development. */
export function FormExample() {
  const id = useId();
  const [complete, setComplete] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof specimenSchema>>({
    resolver: zodResolver(specimenSchema),
    defaultValues: { label: "" },
  });
  const error = errors.label;
  return (
    <form
      noValidate
      className="max-w-sm space-y-5"
      onSubmit={handleSubmit(() => setComplete(true))}
    >
      <Field>
        <Label htmlFor={id}>Example label</Label>
        <Input
          {...register("label", { onChange: () => setComplete(false) })}
          id={id}
          required
          maxLength={40}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-description${error ? ` ${id}-error` : ""}`}
        />
        <FieldDescription id={`${id}-description`}>
          Use 2–40 characters. This value stays in your browser.
        </FieldDescription>
        {error && <FieldError id={`${id}-error`}>{error.message}</FieldError>}
      </Field>
      <Button type="submit" disabled={isSubmitting}>
        Check example
      </Button>
      {complete && (
        <p role="status" className="flex items-center gap-2 text-sm">
          <Check className="size-4" aria-hidden="true" />
          Example validated. Nothing was saved.
        </p>
      )}
    </form>
  );
}

export function ComponentExamples() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>
            One primary action, quieter alternatives, and clear disabled states.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button>
            <Plus aria-hidden="true" />
            Primary action
          </Button>
          <Button variant="outline">Secondary action</Button>
          <Button variant="ghost">Quiet action</Button>
          <Button disabled>Unavailable</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Dialog</CardTitle>
          <CardDescription>
            Keyboard focus stays within the dialog and returns when it closes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Preview dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>A little more context</DialogTitle>
                <DialogDescription>
                  Press Escape or use the close button to return to the
                  workbench.
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm leading-6">
                Radix manages focus, keyboard controls, and the dialog’s
                accessible relationships.
              </p>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Form states</CardTitle>
          <CardDescription>
            React Hook Form and Zod, composed with shared field primitives.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormExample />
        </CardContent>
      </Card>
    </div>
  );
}
